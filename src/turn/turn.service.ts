import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { group, groupMember, payment, person, turn } from '../database/schema';
import { createOffsetPage, OffsetPage } from '../common/pagination/offset-page';
import { ListTurnsQueryDto } from './dto/list-turns.query';

export interface TurnSummary {
  turn: typeof turn.$inferSelect & {
    beneficiary: { id: string; firstName: string; lastName: string };
  };
  group: Pick<typeof group.$inferSelect, 'id' | 'name' | 'contributionAmount' | 'frequency'>;
  totalExpectedAmount: number;
  totalPaidAmount: number;
  percentagePaid: number;
  participantsPaid: ParticipantPaymentInfo[];
  participantsPending: ParticipantPaymentInfo[];
}

export interface ParticipantPaymentInfo {
  personId: string;
  firstName: string;
  lastName: string;
  turnOrder: number;
  paymentId: string | null;
  amount: number | null;
  paidAt: Date | null;
}

@Injectable()
export class TurnService {
  constructor(@Inject('DB_CONNECTION') private readonly db: NodePgDatabase) {}

  async findAll(groupId: string, query: ListTurnsQueryDto) {
    const { status, page = 0, size = 20 } = query;

    const conditions = [eq(turn.groupId, groupId), isNull(turn.deletedAt)];
    if (status) conditions.push(eq(turn.status, status));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          turn,
          beneficiary: {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
          },
        })
        .from(turn)
        .innerJoin(person, eq(turn.beneficiaryId, person.id))
        .where(where)
        .orderBy(asc(turn.turnNumber))
        .limit(size)
        .offset(page * size),
      this.db.select({ total: count() }).from(turn).where(where),
    ]);

    const content = rows.map(({ turn: t, beneficiary }) => ({ ...t, beneficiary }));
    return createOffsetPage(content, Number(total), page, size);
  }

  async findOne(id: string) {
    const [row] = await this.db
      .select({
        turn,
        beneficiary: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
        },
      })
      .from(turn)
      .innerJoin(person, eq(turn.beneficiaryId, person.id))
      .where(and(eq(turn.id, id), isNull(turn.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException(`Turn ${id} not found`);
    return { ...row.turn, beneficiary: row.beneficiary };
  }

  /**
   * Full breakdown of a turn: paid vs pending participants, amounts, progress.
   */
  async getTurnSummary(turnId: string): Promise<TurnSummary> {
    const [t] = await this.db
      .select({
        turn,
        group: {
          id: group.id,
          name: group.name,
          contributionAmount: group.contributionAmount,
          frequency: group.frequency,
        },
        beneficiary: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
        },
      })
      .from(turn)
      .innerJoin(group, eq(turn.groupId, group.id))
      .innerJoin(person, eq(turn.beneficiaryId, person.id))
      .where(and(eq(turn.id, turnId), isNull(turn.deletedAt)))
      .limit(1);

    if (!t) throw new NotFoundException(`Turn ${turnId} not found`);

    // All active members of the group with their payment status for this turn
    const members = await this.db
      .select({
        personId: groupMember.personId,
        firstName: person.firstName,
        lastName: person.lastName,
        turnOrder: groupMember.turnOrder,
        paymentId: payment.id,
        amount: payment.amount,
        paidAt: payment.paidAt,
        paymentStatus: payment.status,
      })
      .from(groupMember)
      .innerJoin(person, eq(groupMember.personId, person.id))
      .leftJoin(
        payment,
        and(eq(payment.turnId, turnId), eq(payment.participantId, groupMember.personId)),
      )
      .where(
        and(eq(groupMember.groupId, t.turn.groupId), eq(groupMember.status, 'ACTIVE')),
      )
      .orderBy(asc(groupMember.turnOrder));

    const participantsPaid: ParticipantPaymentInfo[] = [];
    const participantsPending: ParticipantPaymentInfo[] = [];

    for (const m of members) {
      const info: ParticipantPaymentInfo = {
        personId: m.personId,
        firstName: m.firstName,
        lastName: m.lastName,
        turnOrder: m.turnOrder,
        paymentId: m.paymentId ?? null,
        amount: m.amount != null ? parseFloat(m.amount) : null,
        paidAt: m.paidAt ?? null,
      };

      if (m.paymentStatus === 'PAID') {
        participantsPaid.push(info);
      } else {
        participantsPending.push(info);
      }
    }

    const totalExpectedAmount = parseFloat(t.turn.totalExpectedAmount);
    const totalPaidAmount = parseFloat(t.turn.totalPaidAmount);
    const percentagePaid =
      totalExpectedAmount > 0
        ? Math.round((totalPaidAmount / totalExpectedAmount) * 100 * 100) / 100
        : 0;

    return {
      turn: { ...t.turn, beneficiary: t.beneficiary },
      group: t.group,
      totalExpectedAmount,
      totalPaidAmount,
      percentagePaid,
      participantsPaid,
      participantsPending,
    };
  }

  /**
   * Admin endpoint: manually trigger turn completion check.
   * Normally called automatically by PaymentService after each payment.
   */
  async completeTurnIfReady(turnId: string): Promise<typeof turn.$inferSelect> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(turn)
        .where(and(eq(turn.id, turnId), isNull(turn.deletedAt)))
        .for('update')
        .limit(1);

      if (!locked) throw new NotFoundException(`Turn ${turnId} not found`);

      if (locked.status === 'COMPLETED') {
        return locked; // idempotent
      }

      if (locked.status !== 'ACTIVE') {
        throw new BadRequestException(`Turn is ${locked.status}, not ACTIVE`);
      }

      const expected = parseFloat(locked.totalExpectedAmount);
      const paid = parseFloat(locked.totalPaidAmount);

      if (paid < expected) {
        throw new BadRequestException(
          `Turn is not fully paid: ${paid} / ${expected}`,
        );
      }

      const now = new Date();

      const [completed] = await tx
        .update(turn)
        .set({ status: 'COMPLETED', completedAt: now, updatedAt: now })
        .where(eq(turn.id, turnId))
        .returning();

      // Activate the next PENDING turn in this group
      const [nextTurn] = await tx
        .select()
        .from(turn)
        .where(and(eq(turn.groupId, locked.groupId), eq(turn.status, 'PENDING')))
        .orderBy(asc(turn.turnNumber))
        .limit(1);

      if (nextTurn) {
        await tx
          .update(turn)
          .set({ status: 'ACTIVE', updatedAt: now })
          .where(eq(turn.id, nextTurn.id));
      } else {
        // All turns completed → mark group as COMPLETED
        await tx
          .update(group)
          .set({ status: 'COMPLETED', updatedAt: now })
          .where(eq(group.id, locked.groupId));
      }

      return completed;
    });
  }
}
