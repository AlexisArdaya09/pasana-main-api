import { date, integer, numeric, pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';
import { frequencyEnum, groupStatusEnum } from '../enums';

export const group = pgTable('group', {
  ...baseSchema,
  name: varchar('name', { length: 150 }).notNull(),
  description: varchar('description', { length: 500 }),
  frequency: frequencyEnum('frequency').notNull().default('MONTHLY'),
  contributionAmount: numeric('contribution_amount', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  // Nullable: set when the group is fully configured (all members added)
  startDate: date('start_date', { mode: 'date' }),
  endDate: date('end_date', { mode: 'date' }),
  status: groupStatusEnum('status').notNull().default('ACTIVE'),
  participantCount: integer('participant_count').notNull().default(0),
  totalAmountPerTurn: numeric('total_amount_per_turn', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
});

export type Group = BaseTableType & {
  name: string;
  description: string | null;
  frequency: 'WEEKLY' | 'MONTHLY' | 'BIRTHDAY';
  contributionAmount: string;
  startDate: Date | null;
  endDate: Date | null;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  participantCount: number;
  totalAmountPerTurn: string;
};

export type NewGroup = Omit<Group, keyof BaseTableType>;
