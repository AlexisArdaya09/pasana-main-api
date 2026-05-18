import { formatDateOnly } from './format-date-only';

describe('formatDateOnly', () => {
  it('returns YYYY-MM-DD from PostgreSQL date at T03:00Z (no off-by-one)', () => {
    const pgDate = new Date('2026-01-15T03:00:00.000Z');
    expect(formatDateOnly(pgDate)).toBe('2026-01-15');
  });

  it('returns YYYY-MM-DD from date string', () => {
    expect(formatDateOnly('2026-01-15')).toBe('2026-01-15');
  });
});
