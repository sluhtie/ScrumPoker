import pg from 'pg';
import type { Room } from './game';
import { GameError } from './game';
const globalDb = globalThis as typeof globalThis & {
  pokerPool?: pg.Pool;
  pokerSchema?: Promise<unknown>;
};
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return (globalDb.pokerPool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? {
            rejectUnauthorized: true,
            ...(process.env.DATABASE_CA
              ? { ca: process.env.DATABASE_CA.replace(/\\n/g, '\n') }
              : {}),
          }
        : undefined,
  }));
}
export async function ready() {
  if (!globalDb.pokerSchema)
    globalDb.pokerSchema = pool()
      .query(
        'CREATE TABLE IF NOT EXISTS poker_rooms (code TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())',
      )
      .catch((e) => {
        globalDb.pokerSchema = undefined;
        throw e;
      });
  await globalDb.pokerSchema;
}
export async function insert(room: Room) {
  await ready();
  await pool().query('INSERT INTO poker_rooms(code,data) VALUES($1,$2)', [
    room.code,
    JSON.stringify(room),
  ]);
}
export async function read(code: string) {
  await ready();
  const { rows } = await pool().query(
    'SELECT data FROM poker_rooms WHERE code=$1',
    [code],
  );
  if (!rows[0]) throw new GameError('ROOM_NOT_FOUND', 404);
  return rows[0].data as Room;
}
export async function mutate<T>(
  code: string,
  fn: (room: Room) => T,
): Promise<T> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT data FROM poker_rooms WHERE code=$1 FOR UPDATE',
      [code],
    );
    if (!rows[0]) throw new GameError('ROOM_NOT_FOUND', 404);
    const room = rows[0].data as Room;
    const result = fn(room);
    await client.query(
      'UPDATE poker_rooms SET data=$2, updated_at=now() WHERE code=$1',
      [code, JSON.stringify(room)],
    );
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
