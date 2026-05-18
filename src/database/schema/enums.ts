import { pgEnum } from 'drizzle-orm/pg-core';

export const frequencyEnum = pgEnum('frequency', ['WEEKLY', 'MONTHLY', 'BIRTHDAY']);
export const groupStatusEnum = pgEnum('group_status', ['ACTIVE', 'COMPLETED', 'PAUSED']);
export const memberStatusEnum = pgEnum('member_status', ['ACTIVE', 'INACTIVE']);
export const turnStatusEnum = pgEnum('turn_status', ['PENDING', 'ACTIVE', 'COMPLETED']);
export const paymentStatusEnum = pgEnum('payment_status', ['PENDING', 'PAID']);
export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'QR']);
export const deliveryDateStrategyEnum = pgEnum('delivery_date_strategy', [
  'SAME_DAY',
  'DAYS_BEFORE',
]);
