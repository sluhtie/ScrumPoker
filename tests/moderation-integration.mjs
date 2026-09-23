import assert from 'node:assert/strict';
import pg from 'pg';
const base = process.env.TEST_ORIGIN || 'http://localhost:3000';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let code;
async function api(path, token, data, status = 200) {
  const response = await fetch(base + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
try {
  const created = await api(
    '/api/rooms',
    '',
    { name: 'Host', title: 'Moderation integration' },
    201,
  );
  code = created.code;
  const path = '/api/rooms/' + code;
  const joined = await api(path, '', { type: 'join', name: 'Guest' });
  const guestId = joined.room.you;
  const hostId = joined.room.hostId;
  await api(path, joined.token, { type: 'removeMember', id: hostId }, 403);
  await api(
    path,
    joined.token,
    { type: 'setObserver', id: hostId, value: true },
    403,
  );
  await api(path, created.token, { type: 'removeMember', id: hostId }, 403);
  await api(path, created.token, {
    type: 'setObserver',
    id: guestId,
    value: true,
  });
  let guest = await api(path, joined.token);
  assert.equal(
    guest.members.find((m) => m.id === guestId).observerLocked,
    true,
  );
  await api(path, joined.token, { type: 'spectator', value: false }, 403);
  await api(
    path,
    joined.token,
    { type: 'vote', value: '5', round: guest.round },
    403,
  );
  const rejoin = await api(path, joined.token, {
    type: 'join',
    name: 'Same session',
  });
  assert.equal(rejoin.room.members.length, 2);
  assert.equal(rejoin.room.you, guestId);
  assert.equal(
    rejoin.room.members.find((m) => m.id === guestId).observerLocked,
    true,
  );
  await api(path, created.token, {
    type: 'setObserver',
    id: guestId,
    value: false,
  });
  await api(path, created.token, {
    type: 'addStory',
    title: 'Moderated round',
  });
  guest = await api(path, joined.token);
  await api(path, joined.token, {
    type: 'vote',
    value: '5',
    round: guest.round,
  });
  await api(path, created.token, { type: 'removeMember', id: guestId });
  await api(path, joined.token, undefined, 401);
  await api(path, joined.token, { type: 'join', name: 'Removed session' }, 401);
  await api(
    path,
    joined.token,
    { type: 'vote', value: '8', round: guest.round },
    401,
  );
  await api(path, joined.token, { type: 'avatar', avatar: 'cat' }, 401);
  const room = await api(path, created.token);
  assert.equal(room.members.length, 1);
  assert.ok(!JSON.stringify(room).includes('secret'));
  console.log(
    'PASS: host authorization, persisted observer lock, role restoration, duplicate join protection, and revoked read/write access after removal',
  );
} finally {
  if (code) await db.query('DELETE FROM poker_rooms WHERE code=$1', [code]);
  await db.end();
}
