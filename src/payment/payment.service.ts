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
import { group, groupMember, payment, turn } from '../database/schema';
import { createOffsetPage, OffsetPage } from '../common/pagination/offset-page';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { RegisterBatchPaymentDto } from './dto/register-batch-payment.dto';

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
   * Registers a payment for a participant in an active turn.
   *
   * Concurrency strategy:
   *   SELECT ... FOR UPDATE locks the turn row so only one transaction
   *   can update totalPaidAmount at a time. The UNIQUE index on
   *   (turn_id, participant_id) provides a second guard against duplicates.
   */
  async registerPayment(dto: RegisterPaymentDto): Promise<RegisterPaymentResult> {
    return this.db.transaction(async (tx) => {
      // ── 1. Lock the turn row (prevents race conditions) ──────────────────
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
          `Turn is ${lockedTurn.status}. Only ACTIVE turns accept payments`,
        );
      }

      // ── 2. Resolve exact slot by (personId + turnOrder + groupId) ──────────
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

      // ── 3. Check for duplicate payment (per slot, not per person) ────────
      const [existing] = await tx
        .select({ id: payment.id, status: payment.status })
        .from(payment)
        .where(
          and(
            eq(payment.turnId, dto.turnId),
            eq(payment.participantId, member.id),
          ),
        )
        .limit(1);

      if (existing?.status === 'PAID') {
        throw new ConflictException(
          `Slot turnOrder=${dto.turnOrder} for person ${dto.participantId} already paid for turn ${dto.turnId}`,
        );
      }

      // ── 4. Get contribution amount from group ─────────────────────────────
      const [g] = await tx
        .select({ contributionAmount: group.contributionAmount })
        .from(group)
        .where(eq(group.id, lockedTurn.groupId))
        .limit(1);

      const amount = parseFloat(g.contributionAmount);
      const now = new Date();

      // ── 5. Insert payment ─────────────────────────────────────────────────
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

      // ── 6. Update totalPaidAmount (safe: we hold the FOR UPDATE lock) ─────
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

      // ── 7. Complete turn if fully paid ────────────────────────────────────
      if (paid >= expected) {
        await tx
          .update(turn)
          .set({ status: 'COMPLETED', completedAt: now, updatedAt: now })
          .where(eq(turn.id, dto.turnId));

        updatedTurn.status = 'COMPLETED';
        updatedTurn.completedAt = now;

        // Activate the next PENDING turn
        const [nextTurn] = await tx
          .select()
          .from(turn)
          .where(
            and(eq(turn.groupId, lockedTurn.groupId), eq(turn.status, 'PENDING')),
          )
          .orderBy(asc(turn.scheduledDate), asc(turn.turnNumber))
          .limit(1);

        if (nextTurn) {
          await tx
            .update(turn)
            .set({ status: 'ACTIVE', updatedAt: now })
            .where(eq(turn.id, nextTurn.id));
          nextTurnActivated = true;
        } else {
          // All turns done → complete the group
          await tx
            .update(group)
            .set({ status: 'COMPLETED', updatedAt: now })
            .where(eq(group.id, lockedTurn.groupId));
          groupCompleted = true;
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
        nextTurnActivated,
        groupCompleted,
      };
    });
  }

  /**
   * Registers multiple payments for the same active turn in one transaction.
   * All-or-nothing: any validation failure rolls back the entire batch.
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
          `Turn is ${lockedTurn.status}. Only ACTIVE turns accept payments`,
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
        await tx
          .update(turn)
          .set({ status: 'COMPLETED', completedAt: now, updatedAt: now })
          .where(eq(turn.id, dto.turnId));

        const [nextTurn] = await tx
          .select()
          .from(turn)
          .where(and(eq(turn.groupId, lockedTurn.groupId), eq(turn.status, 'PENDING')))
          .orderBy(asc(turn.scheduledDate), asc(turn.turnNumber))
          .limit(1);

        if (nextTurn) {
          await tx
            .update(turn)
            .set({ status: 'ACTIVE', updatedAt: now })
            .where(eq(turn.id, nextTurn.id));
        } else {
          await tx
            .update(group)
            .set({ status: 'COMPLETED', updatedAt: now })
            .where(eq(group.id, lockedTurn.groupId));
        }
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
  ): Promise<OffsetPage<typeof payment.$inferSelect>> {
    const where = and(eq(payment.turnId, turnId), isNull(payment.deletedAt));

    const [content, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(payment)
        .where(where)
        .orderBy(payment.paidAt)
        .limit(size)
        .offset(page * size),
      this.db.select({ total: count() }).from(payment).where(where),
    ]);

    return createOffsetPage(content, Number(total), page, size);
  }
}
