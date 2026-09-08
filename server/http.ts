import { GameError } from './game';
import { errorText } from '../lib/i18n';
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
export function failure(error: unknown) {
  if (error instanceof GameError)
    return json({ error: error.message, code: error.code }, error.status);
  console.error(
    'Room operation failed',
    error instanceof Error ? error.message : 'Unknown error',
  );
  return json(
    {
      error: errorText('en', 'DATABASE_UNAVAILABLE'),
      code: 'DATABASE_UNAVAILABLE',
    },
    503,
  );
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 8192) throw new GameError('REQUEST_TOO_LARGE', 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw 0;
    return value as Record<string, unknown>;
  } catch {
    throw new GameError('INVALID_REQUEST');
  }
}
export function origin(request: Request) {
  const source = request.headers.get('origin');
  const allowed = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (source && source !== allowed)
    throw new GameError('ORIGIN_NOT_ALLOWED', 403);
}
export const token = (r: Request) =>
  r.headers.get('authorization')?.replace(/^Bearer /, '') || '';
