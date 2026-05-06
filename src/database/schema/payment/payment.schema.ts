import { numeric, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';
import { turn } from '../turn/turn.schema';
import { groupMember } from '../group-member/group-member.schema';
import { paymentMethodEnum, paymentStatusEnum } from '../enums';

export const payment = pgTable(
  'payment',
  {
    ...baseSchema,
    turnId: text('turn_id')
      .notNull()
      .references(() => turn.id),
    // References group_member.id (slot), not person.id — allows a person with
    // multiple slots to pay once per slot per turn.
    participantId: text('participant_id')
      .notNull()
      .references(() => groupMember.id),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    status: paymentStatusEnum('status').notNull().default('PENDING'),
    method: paymentMethodEnum('method').notNull(),
    paidAt: timestamp('paid_at'),
  },
  (t) => [
    // DB-level guard: one payment record per participant per turn
    uniqueIndex('uq_payment_turn_participant').on(t.turnId, t.participantId),
  ],
);

export type Payment = BaseTableType & {
  turnId: string;
  participantId: string;
  amount: string; // numeric → string
  status: 'PENDING' | 'PAID';
  method: 'CASH' | 'QR';
  paidAt: Date | null;
};
