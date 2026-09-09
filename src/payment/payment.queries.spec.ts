import { PgDialect } from 'drizzle-orm/pg-core';
import { livePaidPaymentForSlot, livePaymentForSlot } from './payment.queries';

const dialect = new PgDialect();

const toSql = (condition: ReturnType<typeof livePaymentForSlot>) =>
  dialect.sqlToQuery(condition!).sql;

/**
 * These guard the bug that shipped twice: a reverted (soft-deleted) payment was
 * still read as PAID, which raised a false 409 and then a unique-index 500 when
 * the same slot was charged again.
 */
describe('payment slot queries', () => {
  it('livePaymentForSlot excludes soft-deleted payments', () => {
    const sql = toSql(livePaymentForSlot('turn-1', 'member-1'));

    expect(sql).toContain('"deleted_at" is null');
  });

  it('livePaymentForSlot scopes to the given turn and slot', () => {
    const sql = toSql(livePaymentForSlot('turn-1', 'member-1'));

    expect(sql).toContain('"turn_id"');
    expect(sql).toContain('"participant_id"');
  });

  it('livePaidPaymentForSlot also excludes soft-deleted payments', () => {
    const sql = toSql(livePaidPaymentForSlot('turn-1', 'member-1'));

    expect(sql).toContain('"deleted_at" is null');
  });

  it('livePaidPaymentForSlot restricts to PAID rows', () => {
    const sql = toSql(livePaidPaymentForSlot('turn-1', 'member-1'));

    expect(sql).toContain('"status"');
  });

  it('binds the turn and slot ids as parameters, not inlined values', () => {
    const query = dialect.sqlToQuery(livePaymentForSlot('turn-1', 'member-1')!);

    expect(query.params).toEqual(expect.arrayContaining(['turn-1', 'member-1']));
  });
});
