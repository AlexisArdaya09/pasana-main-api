import { date, pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseSchema } from '../base/base.schema';
import { BaseTableType } from '../base/base.types';

export const person = pgTable('person', {
  ...baseSchema,
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  birthday: date('birthday', { mode: 'date' }).notNull(),
  dni: varchar('dni', { length: 32 }).notNull().unique(),
  phone: varchar('phone', { length: 30 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
});

export type Person = BaseTableType & {
  firstName: string;
  lastName: string;
  birthday: Date;
  dni: string;
  phone: string;
  email: string;
};

export type NewPerson = Omit<Person, keyof BaseTableType>;
