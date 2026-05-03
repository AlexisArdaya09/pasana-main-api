import { numeric, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';
import { turn } from '../turn/turn.schema';
import { person } from '../person/person.schema';
import { paymentStatusEnum } from '../enums';

export const payment = pgTable(
  'payment',
  {
    ...baseSchema,
    turnId: text('turn_id')
      .notNull()
      .references(() => turn.id),
    participantId: text('participant_id')
      .notNull()
      .references(() => person.id),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    status: paymentStatusEnum('status').notNull().default('PENDING'),
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
  paidAt: Date | null;
};
