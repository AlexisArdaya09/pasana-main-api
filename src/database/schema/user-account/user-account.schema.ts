import { boolean, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';
import { person } from '../person/person.schema';
import { userRoleEnum } from '../enums';

export const userAccount = pgTable('user_account', {
  ...baseSchema,
  personId: text('person_id')
    .references(() => person.id)
    .unique(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // Null for Google-only accounts: they never set a local password.
  passwordHash: varchar('password_hash', { length: 255 }),
  passwordExpired: boolean('password_expired').notNull().default(false),
  googleId: varchar('google_id', { length: 255 }).unique(),
  role: userRoleEnum('role').notNull().default('ADMIN'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
});

export type UserRole = 'SUPER_ADMIN' | 'ADMIN';

export type UserAccount = BaseTableType & {
  personId: string | null;
  username: string;
  email: string;
  passwordHash: string | null;
  passwordExpired: boolean;
  googleId: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
};

export type NewUserAccount = Omit<UserAccount, keyof BaseTableType>;
