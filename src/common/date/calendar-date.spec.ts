import { computeDeliveryDate, subtractCalendarDays } from './calendar-date';

describe('calendar-date', () => {
  it('subtractCalendarDays uses calendar arithmetic', () => {
    const scheduled = new Date('2026-02-09T12:00:00.000Z');
    const delivery = subtractCalendarDays(scheduled, 2);
    expect(delivery.toISOString().slice(0, 10)).toBe('2026-02-07');
  });

  it('computeDeliveryDate SAME_DAY', () => {
    const scheduled = new Date('2026-02-09T12:00:00.000Z');
    const delivery = computeDeliveryDate(scheduled, 'SAME_DAY', null);
    expect(delivery.toISOString().slice(0, 10)).toBe('2026-02-09');
  });

  it('computeDeliveryDate DAYS_BEFORE', () => {
    const scheduled = new Date('2026-02-09T12:00:00.000Z');
    const delivery = computeDeliveryDate(scheduled, 'DAYS_BEFORE', 2);
    expect(delivery.toISOString().slice(0, 10)).toBe('2026-02-07');
  });
});
