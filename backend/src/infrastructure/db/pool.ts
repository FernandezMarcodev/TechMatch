import pg from 'pg';

export type DbPool = pg.Pool;
export type DbClient = pg.PoolClient;
export type Queryable = Pick<pg.Pool, 'query'>;

export function createPool(connectionString: string): DbPool {
  return new pg.Pool({ connectionString, max: 10 });
}

export async function withTransaction<T>(
  pool: DbPool,
  fn: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** pg returns NUMERIC as string to avoid precision loss; our values fit in a double. */
export function toNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}
