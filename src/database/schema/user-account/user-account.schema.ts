import { boolean, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';
import { person } from '../person/person.schema';

export const userAccount = pgTable('user_account', {
  ...baseSchema,
  personId: text('person_id')
    .references(() => person.id)
    .unique(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  passwordExpired: boolean('password_expired').notNull().default(false),
});

export type UserAccount = BaseTableType & {
  personId: string | null;
  username: string;
  email: string;
  passwordHash: string;
  passwordExpired: boolean;
};

export type NewUserAccount = Omit<UserAccount, keyof BaseTableType>;
