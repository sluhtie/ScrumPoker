import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDeck, isNumericDeck, numericCard } from '../lib/poker.ts';
import {
  createRoom,
  member,
  action,
  view,
  authenticate,
} from '../server/game.ts';
void test('votes stay private until host reveals; only host controls rounds', () => {
  const { room, token } = createRoom('Alice', 'Sprint');
  const alice = authenticate(room, token);
  const bob = member('Bob').member;
  room.members.push(bob);
  action(room, alice, { type: 'addStory', title: 'Search' });
  action(room, bob, { type: 'vote', value: '8', round: room.round });
  const hidden = view(room, alice);
  assert.equal(hidden.members[1].vote, null);
  assert.equal(hidden.members[1].voted, true);
  assert.equal(JSON.stringify(hidden).includes(bob.secret), false);
  assert.throws(
    () => action(room, bob, { type: 'reveal', round: room.round }),
    { code: 'HOST_ONLY' },
  );
  action(room, alice, { type: 'reveal', round: room.round });
  assert.equal(view(room, alice).members[1].vote, '8');
  assert.throws(
    () => action(room, bob, { type: 'vote', value: '3', round: room.round }),
    { code: 'VOTING_CLOSED' },
  );
});
void test('new rounds reject stale votes and preserve estimates', () => {
  const { room } = createRoom('Alice', 'Sprint');
  const host = room.members[0];
  action(room, host, { type: 'addStory', title: 'First' });
  const previous = room.round;
  action(room, host, { type: 'vote', value: '5', round: room.round });
  action(room, host, { type: 'reveal', round: room.round });
  action(room, host, { type: 'estimate', value: '5', round: room.round });
  action(room, host, { type: 'reset', round: room.round });
  assert.equal(host.vote, null);
  assert.equal(room.stories[0].estimate, '5');
  assert.throws(
    () => action(room, host, { type: 'vote', value: '8', round: previous }),
    { code: 'STALE_VOTE' },
  );
  assert.throws(() => authenticate(room, 'wrong'), { code: 'REJOIN_REQUIRED' });
  assert.throws(
    () => action(room, host, { type: 'vote', value: '999', round: room.round }),
    { code: 'INVALID_CARD' },
  );
});

void test('room settings are host-only, validated, and preserve old rooms', () => {
  const { room } = createRoom('Alice', 'Sprint');
  const host = room.members[0];
  const guest = member('Bob').member;
  room.members.push(guest);
  const settings = {
    type: 'settings',
    title: 'Sprint 2',
    deck: 'tshirt',
    autoReveal: true,
    showAverage: false,
    round: room.round,
  };
  assert.throws(() => action(room, guest, settings), { code: 'HOST_ONLY' });
  assert.throws(() => action(room, host, { ...settings, deck: '__proto__' }), {
    code: 'INVALID_SETTINGS',
  });
  action(room, host, settings);
  assert.equal(room.title, 'Sprint 2');
  assert.equal(room.settings.deck, 'tshirt');
  assert.equal(room.settings.autoReveal, true);
  // Existing JSON documents created before room settings remain readable.
  const legacy = JSON.parse(JSON.stringify(room));
  delete legacy.settings;
  delete legacy.members[0].spectator;
  const restored = view(legacy, legacy.members[0]);
  assert.equal(restored.settings.deck, 'fibonacci');
  assert.equal(restored.members[0].spectator, false);
});

void test('automatic reveal excludes observers and supports T-shirt estimates', () => {
  const { room } = createRoom('Alice', 'Sprint');
  const host = room.members[0];
  const guest = member('Bob').member;
  room.members.push(guest);
  action(room, host, {
    type: 'settings',
    title: room.title,
    deck: 'tshirt',
    autoReveal: true,
    showAverage: false,
    round: room.round,
  });
  action(room, host, { type: 'addStory', title: 'Sizing' });
  action(room, guest, { type: 'spectator', value: true });
  assert.throws(
    () => action(room, guest, { type: 'vote', value: 'M', round: room.round }),
    { code: 'OBSERVER_CANNOT_VOTE' },
  );
  assert.throws(
    () => action(room, host, { type: 'vote', value: '5', round: room.round }),
    { code: 'INVALID_CARD' },
  );
  action(room, host, { type: 'vote', value: 'M', round: room.round });
  assert.equal(room.revealed, true);
  action(room, host, { type: 'estimate', value: 'M', round: room.round });
  assert.equal(room.stories[0].estimate, 'M');
  assert.throws(
    () => action(room, guest, { type: 'spectator', value: false }),
    { code: 'MODE_LOCKED' },
  );
  action(room, host, { type: 'reset', round: room.round });
  action(room, host, { type: 'spectator', value: true });
  assert.equal(room.revealed, false, 'A table with no voters must not reveal');
  action(room, guest, { type: 'spectator', value: false });
  action(room, guest, { type: 'vote', value: 'XL', round: room.round });
  assert.equal(room.revealed, true);
});

void test('deck changes cannot erase hidden votes and reset a revealed round', () => {
  const { room } = createRoom('Alice', 'Sprint');
  const host = room.members[0];
  action(room, host, { type: 'addStory', title: 'First' });
  action(room, host, { type: 'vote', value: '5', round: room.round });
  const settings = {
    type: 'settings',
    title: room.title,
    deck: 'powers',
    autoReveal: false,
    showAverage: true,
    round: room.round,
  };
  assert.throws(() => action(room, host, settings), { code: 'DECK_LOCKED' });
  assert.equal(host.vote, '5');
  action(room, host, { type: 'reveal', round: room.round });
  const previous = room.round;
  action(room, host, settings);
  assert.equal(room.settings.deck, 'powers');
  assert.equal(room.revealed, false);
  assert.equal(host.vote, null);
  assert.ok(room.round > previous);
  assert.throws(
    () => action(room, host, { type: 'vote', value: '8', round: previous }),
    { code: 'STALE_VOTE' },
  );
});

void test('room creation applies chosen settings before the first round', () => {
  const options = {
    deck: 'powers' as const,
    autoReveal: true,
    showAverage: false,
  };
  const { room } = createRoom('Alice', 'Sprint', options);
  assert.deepEqual(room.settings, options);
  options.autoReveal = false;
  assert.equal(
    room.settings.autoReveal,
    true,
    'Room settings are an independent copy',
  );
  const host = room.members[0];
  action(room, host, { type: 'addStory', title: 'First round' });
  assert.throws(
    () => action(room, host, { type: 'vote', value: '5', round: room.round }),
    { code: 'INVALID_CARD' },
  );
  action(room, host, { type: 'vote', value: '4', round: room.round });
  assert.equal(room.revealed, true);
  assert.equal(createRoom('Bob', 'Default').room.settings.deck, 'fibonacci');
  for (const invalid of [
    null,
    [],
    {},
    { ...options, deck: '__proto__' },
    { ...options, autoReveal: 'true' },
  ]) {
    assert.throws(() => createRoom('Alice', 'Sprint', invalid), {
      code: 'INVALID_SETTINGS',
    });
  }
});

void test('custom decks persist normalized values and enforce the selected cards', () => {
  const { room } = createRoom('Alice', 'Custom', {
    deck: 'custom',
    customDeck: [' 0.5 ', '2', '8', '?', '☕'],
    autoReveal: false,
    showAverage: true,
  });
  const host = room.members[0];
  assert.deepEqual(getDeck(room.settings), ['0.5', '2', '8', '?', '☕']);
  assert.equal(isNumericDeck(room.settings), true);
  assert.equal(numericCard('0.5'), 0.5);
  assert.equal(numericCard('Infinity'), null);
  action(room, host, { type: 'addStory', title: 'Custom story' });
  assert.throws(
    () => action(room, host, { type: 'vote', value: '5', round: room.round }),
    { code: 'INVALID_CARD' },
  );
  action(room, host, { type: 'vote', value: '0.5', round: room.round });
  const settings = {
    type: 'settings',
    title: room.title,
    ...room.settings,
    customDeck: ['Small', 'Medium', 'Large', '?'],
    round: room.round,
  };
  assert.throws(() => action(room, host, settings), { code: 'DECK_LOCKED' });
  assert.equal(host.vote, '0.5');
  action(room, host, { type: 'reveal', round: room.round });
  action(room, host, { type: 'estimate', value: '0.5', round: room.round });
  const oldRound = room.round;
  action(room, host, settings);
  assert.ok(room.round > oldRound);
  assert.equal(host.vote, null);
  assert.equal(room.stories[0].estimate, '0.5');
  assert.equal(isNumericDeck(room.settings), false);
  action(room, host, { type: 'vote', value: 'Medium', round: room.round });
  action(room, host, { type: 'reveal', round: room.round });
  action(room, host, { type: 'estimate', value: 'Medium', round: room.round });
  assert.equal(room.stories[0].estimate, 'Medium');
});
void test('custom decks reject duplicates, excessive sizes, malformed labels and special-only decks', () => {
  const invalid = [
    undefined,
    [],
    ['1'],
    ['?', '☕'],
    ['1', '1'],
    ['1', ' 1 '],
    ['e\u0301', 'é'],
    ['1', '123456789'],
    ['1', 'a,b'],
    ['1', 'line\nbreak'],
    ['1', 2],
    Array.from({ length: 17 }, (_, i) => String(i)),
  ];
  for (const customDeck of invalid)
    assert.throws(
      () =>
        createRoom('Alice', 'Invalid', {
          deck: 'custom',
          customDeck,
          autoReveal: false,
          showAverage: true,
        }),
      { code: 'INVALID_CUSTOM_DECK' },
    );
  for (const deck of ['modified', 'sequential']) {
    const { room } = createRoom('Alice', 'More decks', {
      deck,
      autoReveal: false,
      showAverage: true,
    });
    action(room, room.members[0], { type: 'addStory', title: 'Story' });
    action(room, room.members[0], {
      type: 'vote',
      value: deck === 'modified' ? '0.5' : '7',
      round: room.round,
    });
    assert.equal(room.members[0].vote, deck === 'modified' ? '0.5' : '7');
  }
});
