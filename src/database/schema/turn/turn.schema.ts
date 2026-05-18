import {
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';
import { group } from '../group/group.schema';
import { person } from '../person/person.schema';
import { turnStatusEnum } from '../enums';

export const turn = pgTable(
  'turn',
  {
    ...baseSchema,
    groupId: text('group_id')
      .notNull()
      .references(() => group.id),
    turnNumber: integer('turn_number').notNull(),
    beneficiaryId: text('beneficiary_id')
      .notNull()
      .references(() => person.id),
    status: turnStatusEnum('status').notNull().default('PENDING'),
    // Computed on creation: contributionAmount × memberCount
    totalExpectedAmount: numeric('total_expected_amount', {
      precision: 12,
      scale: 2,
    }).notNull(),
    // Updated atomically on each payment
    totalPaidAmount: numeric('total_paid_amount', {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default('0'),
    scheduledDate: date('scheduled_date', { mode: 'date' }).notNull(),
    deliveryDate: date('delivery_date', { mode: 'date' }).notNull(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [uniqueIndex('uq_turn_group_number').on(t.groupId, t.turnNumber)],
);

export type Turn = BaseTableType & {
  groupId: string;
  turnNumber: number;
  beneficiaryId: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  totalExpectedAmount: string; // numeric → string in Drizzle
  totalPaidAmount: string;
  scheduledDate: Date;
  deliveryDate: Date;
  completedAt: Date | null;
};
