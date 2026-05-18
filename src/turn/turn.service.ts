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
import { formatDateOnly } from '../common/date/format-date-only';
import { mapTurnForResponse } from './turn.mapper';
import { completeActiveTurnAndAdvanceQueue } from '../payment/payment-turn.logic';

export interface TurnSummary {
  turn: Omit<typeof turn.$inferSelect, 'scheduledDate' | 'deliveryDate'> & {
    scheduledDate: string;
    deliveryDate: string;
    beneficiary: { id: string; firstName: string; lastName: string };
  };
  group: Pick<typeof group.$inferSelect, 'id' | 'name' | 'contributionAmount' | 'frequency'>;
  totalExpectedAmount: number;
  totalPaidAmount: number;
  percentagePaid: number;
  participantsPaid: ParticipantPaymentInfo[];
  participantsPending: ParticipantPaymentInfo[];
  nextTurn?: NextTurnSummary | null;
  participantsAdvancePaid?: AdvancePaymentInfo[];
}

export interface NextTurnSummary {
  id: string;
  turnNumber: number;
  status: string;
  scheduledDate: string;
  deliveryDate: string;
  totalExpectedAmount: number;
  totalPaidAmount: number;
  beneficiary: { id: string; firstName: string; lastName: string };
}

export interface AdvancePaymentInfo {
  personId: string;
  firstName: string;
  lastName: string;
  turnOrder: number;
  paymentId: string;
  amount: number;
  method: 'CASH' | 'QR';
  paidAt: Date | null;
}

export interface ParticipantPaymentInfo {
  /** group_member.id — use as participantId in payment APIs */
  memberId: string;
  personId: string;
  firstName: string;
  lastName: string;
  /** Slot order (group_member.turn_order); required for POST /payments and batch */
  turnOrder: number;
  /** Turn when this slot receives the pasanaco (null if not linked) */
  beneficiaryTurnNumber: number | null;
  /** Delivery date for this slot's beneficiary turn */
  beneficiaryScheduledDate: string | null;
  paymentId: string | null;
  amount: number | null;
  method: 'CASH' | 'QR' | null;
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

    const content = rows.map(({ turn: t, beneficiary }) => ({
      ...mapTurnForResponse(t),
      beneficiary,
    }));
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
    return { ...mapTurnForResponse(row.turn), beneficiary: row.beneficiary };
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

    const beneficiaryTurns = await this.db
      .select({
        turnNumber: turn.turnNumber,
        beneficiaryId: turn.beneficiaryId,
        scheduledDate: turn.scheduledDate,
      })
      .from(turn)
      .where(and(eq(turn.groupId, t.turn.groupId), isNull(turn.deletedAt)));

    const beneficiaryTurnByKey = new Map<string, { turnNumber: number; scheduledDate: Date }>();
    for (const bt of beneficiaryTurns) {
      const dateKey = formatDateOnly(bt.scheduledDate)!;
      beneficiaryTurnByKey.set(`${bt.beneficiaryId}:${dateKey}`, bt);
    }

    // All active members with payment status for this turn (collection list)
    const members = await this.db
      .select({
        memberId: groupMember.id,
        personId: groupMember.personId,
        customDate: groupMember.customDate,
        firstName: person.firstName,
        lastName: person.lastName,
        turnOrder: groupMember.turnOrder,
        paymentId: payment.id,
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.paidAt,
        paymentStatus: payment.status,
      })
      .from(groupMember)
      .innerJoin(person, eq(groupMember.personId, person.id))
      .leftJoin(
        payment,
        and(
          eq(payment.turnId, turnId),
          eq(payment.participantId, groupMember.id),
          eq(payment.status, 'PAID'),
        ),
      )
      .where(
        and(eq(groupMember.groupId, t.turn.groupId), eq(groupMember.status, 'ACTIVE')),
      );

    const participantsPaid: ParticipantPaymentInfo[] = [];
    const participantsPending: ParticipantPaymentInfo[] = [];

    const sortedMembers = [...members].sort((a, b) => {
      const nameCmp = a.lastName.localeCompare(b.lastName, 'es');
      return nameCmp !== 0 ? nameCmp : a.firstName.localeCompare(b.firstName, 'es');
    });

    for (const m of sortedMembers) {
      const dateKey = m.customDate ? formatDateOnly(m.customDate) : null;
      const beneficiaryTurn =
        dateKey != null ? beneficiaryTurnByKey.get(`${m.personId}:${dateKey}`) : undefined;

      const info: ParticipantPaymentInfo = {
        memberId: m.memberId,
        personId: m.personId,
        firstName: m.firstName,
        lastName: m.lastName,
        turnOrder: m.turnOrder,
        beneficiaryTurnNumber: beneficiaryTurn?.turnNumber ?? null,
        beneficiaryScheduledDate: beneficiaryTurn
          ? formatDateOnly(beneficiaryTurn.scheduledDate)
          : null,
        paymentId: m.paymentId ?? null,
        amount: m.amount != null ? parseFloat(m.amount) : null,
        method: m.method ?? null,
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

    let nextTurn: NextTurnSummary | null = null;
    let participantsAdvancePaid: AdvancePaymentInfo[] = [];

    if (t.turn.status === 'ACTIVE') {
      const [nextRow] = await this.db
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
        .where(
          and(
            eq(turn.groupId, t.turn.groupId),
            eq(turn.status, 'PENDING'),
            isNull(turn.deletedAt),
          ),
        )
        .orderBy(asc(turn.scheduledDate), asc(turn.turnNumber))
        .limit(1);

      if (nextRow) {
        const mapped = mapTurnForResponse(nextRow.turn);
        nextTurn = {
          id: mapped.id,
          turnNumber: mapped.turnNumber,
          status: mapped.status,
          scheduledDate: mapped.scheduledDate,
          deliveryDate: mapped.deliveryDate,
          totalExpectedAmount: parseFloat(nextRow.turn.totalExpectedAmount),
          totalPaidAmount: parseFloat(nextRow.turn.totalPaidAmount),
          beneficiary: nextRow.beneficiary,
        };

        const advanceRows = await this.db
          .select({
            personId: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            turnOrder: groupMember.turnOrder,
            paymentId: payment.id,
            amount: payment.amount,
            method: payment.method,
            paidAt: payment.paidAt,
          })
          .from(payment)
          .innerJoin(groupMember, eq(payment.participantId, groupMember.id))
          .innerJoin(person, eq(groupMember.personId, person.id))
          .where(
            and(
              eq(payment.turnId, nextRow.turn.id),
              eq(payment.status, 'PAID'),
              isNull(payment.deletedAt),
            ),
          )
          .orderBy(asc(person.lastName), asc(person.firstName));

        participantsAdvancePaid = advanceRows.map((r) => ({
          personId: r.personId,
          firstName: r.firstName,
          lastName: r.lastName,
          turnOrder: r.turnOrder,
          paymentId: r.paymentId,
          amount: parseFloat(r.amount),
          method: r.method,
          paidAt: r.paidAt,
        }));
      }
    }

    return {
      turn: { ...mapTurnForResponse(t.turn), beneficiary: t.beneficiary },
      group: t.group,
      totalExpectedAmount,
      totalPaidAmount,
      percentagePaid,
      participantsPaid,
      participantsPending,
      nextTurn,
      participantsAdvancePaid,
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

      await completeActiveTurnAndAdvanceQueue(tx, turnId, locked.groupId, now);

      const [completed] = await tx
        .select()
        .from(turn)
        .where(eq(turn.id, turnId))
        .limit(1);

      if (!completed) throw new NotFoundException(`Turn ${turnId} not found`);

      return mapTurnForResponse(completed);
    });
  }
}
