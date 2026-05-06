import { date, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';
import { group } from '../group/group.schema';
import { person } from '../person/person.schema';
import { memberStatusEnum } from '../enums';

export const groupMember = pgTable(
  'group_member',
  {
    ...baseSchema,
    groupId: text('group_id')
      .notNull()
      .references(() => group.id),
    personId: text('person_id')
      .notNull()
      .references(() => person.id),
    turnOrder: integer('turn_order').notNull(),
    status: memberStatusEnum('status').notNull().default('ACTIVE'),
    // Optional date override per slot. BIRTHDAY: replaces person.birthday as base. WEEKLY/MONTHLY: used directly as scheduledDate.
    customDate: date('custom_date', { mode: 'date' }),
  },
  (t) => [
    uniqueIndex('uq_group_member_order').on(t.groupId, t.turnOrder),
  ],
);

export type GroupMember = BaseTableType & {
  groupId: string;
  personId: string;
  turnOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  customDate: Date | null;
};
