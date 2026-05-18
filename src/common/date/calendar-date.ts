/** UTC calendar date at noon (stable across TZ when stored as PostgreSQL date). */
export function utcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0),
  );
}

/** Subtract whole calendar days from a date (UTC). */
export function subtractCalendarDays(date: Date, days: number): Date {
  const d = utcDateOnly(date);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - days),
  );
}

export function computeDeliveryDate(
  scheduledDate: Date,
  strategy: 'SAME_DAY' | 'DAYS_BEFORE',
  daysBefore: number | null,
): Date {
  const scheduled = utcDateOnly(scheduledDate);
  if (strategy === 'SAME_DAY') {
    return scheduled;
  }
  const offset = daysBefore ?? 0;
  if (offset < 1) {
    throw new Error('deliveryDaysBefore must be >= 1 for DAYS_BEFORE strategy');
  }
  return subtractCalendarDays(scheduled, offset);
}
