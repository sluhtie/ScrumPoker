import assert from 'node:assert/strict';
const base = process.env.TEST_ORIGIN || 'http://localhost:3000';
async function api(path, token, data, status = 200) {
  const r = await fetch(base + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await r.json();
  assert.equal(r.status, status, JSON.stringify(result));
  return result;
}
const page = await fetch(base + '/').then((r) => r.text());
assert.match(page, /<html[^>]*lang="en"/);
assert.ok(page.includes('Everyone at the table.'));
const invalidCreation = await api(
  '/api/rooms',
  '',
  { name: 'Host', title: 'Invalid', settings: { deck: 'invalid' } },
  400,
);
assert.equal(invalidCreation.code, 'INVALID_SETTINGS');
assert.equal(invalidCreation.error, 'Invalid settings.');
const created = await api(
  '/api/rooms',
  '',
  {
    name: 'Integration host',
    title: 'Integration test',
    settings: { deck: 'fibonacci', autoReveal: false, showAverage: false },
  },
  201,
);
const path = '/api/rooms/' + created.code;
const joined = await api(path, '', { type: 'join', name: 'Integration guest' });
assert.equal(joined.room.settings.showAverage, false);
assert.equal(joined.room.settings.deck, 'fibonacci');
const unauthorized = await api(path, '', undefined, 401);
assert.equal(unauthorized.code, 'REJOIN_REQUIRED');
assert.equal(unauthorized.error, 'Please join the room again.');
let { room } = await api(path, created.token, {
  type: 'addStory',
  title: 'Test a complete planning round',
});
await Promise.all([
  api(path, created.token, { type: 'vote', value: '3', round: room.round }),
  api(path, joined.token, { type: 'vote', value: '8', round: room.round }),
]);
room = await api(path, created.token);
assert.equal(room.members.filter((m) => m.voted).length, 2);
assert.equal(room.members.find((m) => m.id !== room.you).vote, null);
assert.equal(JSON.stringify(room).includes('secret'), false);
await api(path, joined.token, { type: 'reveal', round: room.round }, 403);
({ room } = await api(path, created.token, {
  type: 'reveal',
  round: room.round,
}));
assert.deepEqual(room.members.map((m) => m.vote).sort(), ['3', '8']);
await api(path, created.token, {
  type: 'estimate',
  value: '5',
  round: room.round,
});
const oldRound = room.round;
({ room } = await api(path, created.token, {
  type: 'reset',
  round: room.round,
}));
assert.equal(room.stories[0].estimate, '5');
assert.ok(room.members.every((m) => !m.voted));
await api(
  path,
  joined.token,
  { type: 'vote', value: '3', round: oldRound },
  409,
);
await api(
  path,
  created.token,
  { type: 'vote', value: '99', round: room.round },
  400,
);
// Settings persist across requests and new clients use the same deck.
await api(
  path,
  joined.token,
  {
    type: 'settings',
    title: 'Denied',
    deck: 'tshirt',
    autoReveal: true,
    showAverage: false,
    round: room.round,
  },
  403,
);
({ room } = await api(path, created.token, {
  type: 'settings',
  title: 'Configured table',
  deck: 'tshirt',
  autoReveal: true,
  showAverage: false,
  round: room.round,
}));
room = await api(path, joined.token);
assert.equal(room.settings.deck, 'tshirt');
assert.equal(room.title, 'Configured table');
({ room } = await api(path, joined.token, { type: 'spectator', value: true }));
await api(
  path,
  joined.token,
  { type: 'vote', value: 'M', round: room.round },
  403,
);
({ room } = await api(path, created.token, {
  type: 'vote',
  value: 'L',
  round: room.round,
}));
assert.equal(room.revealed, true);
assert.equal(room.members.find((m) => m.spectator).vote, null);
({ room } = await api(path, created.token, {
  type: 'estimate',
  value: 'L',
  round: room.round,
}));
assert.equal(room.stories[0].estimate, 'L');

// Custom decks are stored in PostgreSQL and used by every client.
({ room } = await api(path, created.token, {
  type: 'settings',
  title: room.title,
  deck: 'custom',
  customDeck: ['0.5', '2', '8', '?', '☕'],
  autoReveal: false,
  showAverage: true,
  round: room.round,
}));
const reread = await api(path, joined.token);
assert.deepEqual(reread.settings.customDeck, ['0.5', '2', '8', '?', '☕']);
await api(
  path,
  created.token,
  { type: 'vote', value: 'L', round: room.round },
  400,
);
await api(path, created.token, {
  type: 'vote',
  value: '0.5',
  round: room.round,
});
await api(
  path,
  created.token,
  {
    type: 'settings',
    title: room.title,
    deck: 'custom',
    customDeck: ['1', '2', '3'],
    autoReveal: false,
    showAverage: true,
    round: room.round,
  },
  409,
);
({ room } = await api(path, created.token, {
  type: 'reveal',
  round: room.round,
}));
({ room } = await api(path, created.token, {
  type: 'estimate',
  value: '0.5',
  round: room.round,
}));
assert.equal(room.stories[0].estimate, '0.5');
const invalidCustom = await api(
  '/api/rooms',
  '',
  {
    name: 'Invalid',
    title: 'Invalid deck',
    settings: {
      deck: 'custom',
      customDeck: ['1', '1'],
      autoReveal: false,
      showAverage: true,
    },
  },
  400,
);
assert.equal(invalidCustom.code, 'INVALID_CUSTOM_DECK');
const cross = await fetch(base + path, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://untrusted.example',
  },
  body: JSON.stringify({ type: 'join', name: 'CSRF' }),
});
assert.equal(cross.status, 403);
console.log(
  'PASS: creation, joining, concurrent votes, vote privacy, host authorization, revealing, estimates, reset, stale votes, input validation, origin protection, persisted settings, observer mode, automatic reveal, T-shirt estimates, English default, stable error codes, initial settings, custom deck persistence and voting',
);
// Remove only the room created by this test.
if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await db.query('DELETE FROM poker_rooms WHERE code=$1', [created.code]);
  await db.end();
}
