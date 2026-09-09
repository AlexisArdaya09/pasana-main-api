/**
 * Minimal chainable stand-in for a Drizzle query builder.
 *
 * Drizzle builders are thenable, so `await db.select().from(x).where(y)` and
 * `.limit(1)` both have to resolve to the rows. Every chain method returns the
 * same object; only the terminal await matters.
 */
export function queryResult<T>(rows: T[]) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  for (const method of [
    'from',
    'where',
    'orderBy',
    'for',
    'innerJoin',
    'leftJoin',
    'set',
    'values',
    'returning',
    'offset',
    // `limit` keeps returning the builder: callers may still chain
    // `.for('update')` after it before awaiting.
    'limit',
  ]) {
    builder[method] = chain;
  }

  builder.then = (resolve: (v: T[]) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);

  return builder;
}

/**
 * Builds a fake transaction/db object that hands out queued results in order.
 * Each call to select/insert/update pops the next queued row set.
 */
export function fakeDb(queue: unknown[][]) {
  const remaining = [...queue];
  const next = () => queryResult(remaining.length ? remaining.shift()! : []);

  return {
    select: () => next(),
    insert: () => next(),
    update: () => next(),
    delete: () => next(),
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn({
        select: () => next(),
        insert: () => next(),
        update: () => next(),
        delete: () => next(),
      }),
    pending: () => remaining.length,
  };
}
