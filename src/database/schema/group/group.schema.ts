import { date, integer, numeric, pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';
import { deliveryDateStrategyEnum, frequencyEnum, groupStatusEnum } from '../enums';

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
  deliveryDateStrategy: deliveryDateStrategyEnum('delivery_date_strategy')
    .notNull()
    .default('SAME_DAY'),
  deliveryDaysBefore: integer('delivery_days_before'),
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
  deliveryDateStrategy: 'SAME_DAY' | 'DAYS_BEFORE';
  deliveryDaysBefore: number | null;
};

export type NewGroup = Omit<Group, keyof BaseTableType>;
