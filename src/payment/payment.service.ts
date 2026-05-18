import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createId } from '@paralleldrive/cuid2';
import { group, groupMember, payment, person, turn } from '../database/schema';
import { createOffsetPage, OffsetPage } from '../common/pagination/offset-page';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { RegisterBatchPaymentDto } from './dto/register-batch-payment.dto';
import { PaymentListItemDto } from './dto/payment-list-item.dto';
import {
  completeActiveTurnAndAdvanceQueue,
  resolvePayableTurn,
} from './payment-turn.logic';

export interface RegisterPaymentResult {
  payment: typeof payment.$inferSelect;
  turn: {
    id: string;
    turnNumber: number;
    status: string;
    totalExpectedAmount: number;
    totalPaidAmount: number;
    percentagePaid: number;
    completedAt: Date | null;
  };
  advancePayment: boolean;
  nextTurnActivated: boolean;
  groupCompleted: boolean;
}

export interface BatchPaymentResultItem {
  participantId: string;
  turnOrder: number;
  paymentId: string;
}

export interface RegisterBatchPaymentResult {
  turnId: string;
  method: 'CASH' | 'QR';
  registered: number;
  failed: number;
  payments: BatchPaymentResultItem[];
}

@Injectable()
export class PaymentService {
  constructor(@Inject('DB_CONNECTION') private readonly db: NodePgDatabase) {}

  /**
   * Registers a payment for the ACTIVE turn or an advance on the next PENDING turn.
   */
  async registerPayment(dto: RegisterPaymentDto): Promise<RegisterPaymentResult> {
    return this.db.transaction(async (tx) => {
      const payable = await resolvePayableTurn(tx, dto.turnId);
      const lockedTurn = payable.target;

      const [member] = await tx
        .select()
        .from(groupMember)
        .where(
          and(
            eq(groupMember.personId, dto.participantId),
            eq(groupMember.turnOrder, dto.turnOrder),
            eq(groupMember.groupId, lockedTurn.groupId),
            eq(groupMember.status, 'ACTIVE'),
            isNull(groupMember.deletedAt),
          ),
        )
        .limit(1);

      if (!member) {
        throw new NotFoundException(
          `No active slot found for person ${dto.participantId} with turnOrder ${dto.turnOrder} in this group`,
        );
      }

      const [existing] = await tx
        .select({ id: payment.id, status: payment.status })
        .from(payment)
        .where(
          and(eq(payment.turnId, dto.turnId), eq(payment.participantId, member.id)),
        )
        .limit(1);

      if (existing?.status === 'PAID') {
        throw new ConflictException(
          `Slot turnOrder=${dto.turnOrder} for person ${dto.participantId} already paid for turn ${dto.turnId}`,
        );
      }

      const [g] = await tx
        .select({ contributionAmount: group.contributionAmount })
        .from(group)
        .where(eq(group.id, lockedTurn.groupId))
        .limit(1);

      const amount = parseFloat(g.contributionAmount);
      const now = new Date();

      const [createdPayment] = await tx
        .insert(payment)
        .values({
          id: createId(),
          turnId: dto.turnId,
          participantId: member.id,
          amount: amount.toFixed(2),
          status: 'PAID',
          method: dto.method,
          paidAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const newTotal = parseFloat(lockedTurn.totalPaidAmount) + amount;

      const [updatedTurn] = await tx
        .update(turn)
        .set({ totalPaidAmount: newTotal.toFixed(2), updatedAt: now })
        .where(eq(turn.id, dto.turnId))
        .returning();

      const expected = parseFloat(updatedTurn.totalExpectedAmount);
      const paid = parseFloat(updatedTurn.totalPaidAmount);

      let nextTurnActivated = false;
      let groupCompleted = false;

      if (payable.mode === 'active' && paid >= expected) {
        const completion = await completeActiveTurnAndAdvanceQueue(
          tx,
          dto.turnId,
          lockedTurn.groupId,
          now,
        );
        nextTurnActivated = completion.nextTurnActivated;
        groupCompleted = completion.groupCompleted;

        const [refreshed] = await tx
          .select()
          .from(turn)
          .where(eq(turn.id, dto.turnId))
          .limit(1);
        if (refreshed) {
          updatedTurn.status = refreshed.status;
          updatedTurn.completedAt = refreshed.completedAt;
        }
      }

      const percentagePaid =
        expected > 0 ? Math.round((paid / expected) * 100 * 100) / 100 : 0;

      return {
        payment: createdPayment,
        turn: {
          id: updatedTurn.id,
          turnNumber: updatedTurn.turnNumber,
          status: updatedTurn.status,
          totalExpectedAmount: expected,
          totalPaidAmount: paid,
          percentagePaid,
          completedAt: updatedTurn.completedAt,
        },
        advancePayment: payable.mode === 'advance',
        nextTurnActivated,
        groupCompleted,
      };
    });
  }

  /**
   * Batch payments for the ACTIVE turn only (advance payments use POST /payments one by one).
   */
  async registerBatchPayment(
    dto: RegisterBatchPaymentDto,
  ): Promise<RegisterBatchPaymentResult> {
    return this.db.transaction(async (tx) => {
      const [lockedTurn] = await tx
        .select()
        .from(turn)
        .where(and(eq(turn.id, dto.turnId), isNull(turn.deletedAt)))
        .for('update')
        .limit(1);

      if (!lockedTurn) {
        throw new NotFoundException(`Turn ${dto.turnId} not found`);
      }

      if (lockedTurn.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Batch payments are only allowed for the ACTIVE turn. Use POST /payments for advance payments on the next PENDING turn.',
        );
      }

      const [g] = await tx
        .select({ contributionAmount: group.contributionAmount })
        .from(group)
        .where(eq(group.id, lockedTurn.groupId))
        .limit(1);

      const amount = parseFloat(g.contributionAmount);
      const now = new Date();
      const seenSlots = new Set<string>();
      const results: BatchPaymentResultItem[] = [];

      for (const item of dto.payments) {
        const slotKey = `${item.participantId}:${item.turnOrder}`;
        if (seenSlots.has(slotKey)) {
          throw new ConflictException(
            `Duplicate slot in batch: person ${item.participantId} turnOrder ${item.turnOrder}`,
          );
        }
        seenSlots.add(slotKey);

        const [member] = await tx
          .select()
          .from(groupMember)
          .where(
            and(
              eq(groupMember.personId, item.participantId),
              eq(groupMember.turnOrder, item.turnOrder),
              eq(groupMember.groupId, lockedTurn.groupId),
              eq(groupMember.status, 'ACTIVE'),
              isNull(groupMember.deletedAt),
            ),
          )
          .limit(1);

        if (!member) {
          throw new NotFoundException(
            `No active slot found for person ${item.participantId} with turnOrder ${item.turnOrder} in this group`,
          );
        }

        const [existing] = await tx
          .select({ id: payment.id, status: payment.status })
          .from(payment)
          .where(and(eq(payment.turnId, dto.turnId), eq(payment.participantId, member.id)))
          .limit(1);

        if (existing?.status === 'PAID') {
          throw new ConflictException(
            `Slot turnOrder=${item.turnOrder} for person ${item.participantId} already paid for turn ${dto.turnId}`,
          );
        }

        const [createdPayment] = await tx
          .insert(payment)
          .values({
            id: createId(),
            turnId: dto.turnId,
            participantId: member.id,
            amount: amount.toFixed(2),
            status: 'PAID',
            method: dto.method,
            paidAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        results.push({
          participantId: item.participantId,
          turnOrder: item.turnOrder,
          paymentId: createdPayment.id,
        });
      }

      const batchTotal = amount * dto.payments.length;
      const newTotal = parseFloat(lockedTurn.totalPaidAmount) + batchTotal;

      const [updatedTurn] = await tx
        .update(turn)
        .set({ totalPaidAmount: newTotal.toFixed(2), updatedAt: now })
        .where(eq(turn.id, dto.turnId))
        .returning();

      const expected = parseFloat(updatedTurn.totalExpectedAmount);
      const paid = parseFloat(updatedTurn.totalPaidAmount);

      if (paid >= expected) {
        await completeActiveTurnAndAdvanceQueue(
          tx,
          dto.turnId,
          lockedTurn.groupId,
          now,
        );
      }

      return {
        turnId: dto.turnId,
        method: dto.method,
        registered: results.length,
        failed: 0,
        payments: results,
      };
    });
  }

  async findByTurn(
    turnId: string,
    page = 0,
    size = 50,
  ): Promise<OffsetPage<PaymentListItemDto>> {
    const where = and(
      eq(payment.turnId, turnId),
      isNull(payment.deletedAt),
      eq(payment.status, 'PAID'),
    );

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: payment.id,
          participantId: person.id,
          turnOrder: groupMember.turnOrder,
          method: payment.method,
          amount: payment.amount,
          paidAt: payment.paidAt,
        })
        .from(payment)
        .innerJoin(groupMember, eq(payment.participantId, groupMember.id))
        .innerJoin(person, eq(groupMember.personId, person.id))
        .where(where)
        .orderBy(asc(payment.paidAt))
        .limit(size)
        .offset(page * size),
      this.db.select({ total: count() }).from(payment).where(where),
    ]);

    const content: PaymentListItemDto[] = rows.map((r) => ({
      id: r.id,
      participantId: r.participantId,
      turnOrder: r.turnOrder,
      method: r.method,
      amount: parseFloat(r.amount),
      paidAt: r.paidAt,
    }));

    return createOffsetPage(content, Number(total), page, size);
  }
}
