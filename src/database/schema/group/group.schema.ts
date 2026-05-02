import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';

export const group = pgTable('group', {
  ...baseSchema,
  name: varchar('name', { length: 150 }).notNull(),
  description: varchar('description', { length: 500 }),
});

export type Group = BaseTableType & {
  name: string;
  description: string | null;
};

export type NewGroup = Omit<Group, keyof BaseTableType>;
