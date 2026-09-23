import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createRoom,
  member,
  action,
  authenticate,
  view,
  GameError,
} from '../server/game.ts';

function setup(autoReveal = false) {
  const { room, token } = createRoom('Host', 'Moderation', {
    deck: 'fibonacci',
    autoReveal,
    showAverage: true,
  });
  const joined = member('Guest');
  room.members.push(joined.member);
  const host = room.members[0];
  action(room, host, { type: 'addStory', title: 'A story' });
  return {
    room,
    host,
    guest: joined.member,
    guestToken: joined.token,
    hostToken: token,
  };
}
function hasCode(code: string) {
  return (e: unknown) => e instanceof GameError && e.code === code;
}

void test('only the host can moderate and cannot remove or restrict themselves', () => {
  const { room, host, guest } = setup();
  for (const type of ['removeMember', 'setObserver']) {
    assert.throws(
      () => action(room, guest, { type, id: host.id, value: true }),
      hasCode('HOST_ONLY'),
    );
    assert.throws(
      () => action(room, host, { type, id: host.id, value: true }),
      hasCode('CANNOT_MODERATE_HOST'),
    );
    assert.throws(
      () => action(room, host, { type, id: 'missing', value: true }),
      hasCode('MEMBER_NOT_FOUND'),
    );
    assert.throws(
      () => action(room, host, { type, id: null, value: true }),
      hasCode('INVALID_REQUEST'),
    );
  }
  assert.throws(
    () =>
      action(room, host, { type: 'setObserver', id: guest.id, value: 'true' }),
    hasCode('INVALID_MODE'),
  );
  assert.equal(guest.spectator, false);
  assert.equal(room.members.length, 2);
});

void test('host-assigned observers lose their vote and cannot unlock themselves across rounds', () => {
  const { room, host, guest } = setup();
  action(room, guest, { type: 'vote', value: '8', round: room.round });
  action(room, host, { type: 'setObserver', id: guest.id, value: true });
  assert.equal(guest.vote, null);
  assert.equal(guest.spectator, true);
  assert.equal(guest.observerLocked, true);
  for (const value of [false, true])
    assert.throws(
      () => action(room, guest, { type: 'spectator', value }),
      hasCode('OBSERVER_LOCKED'),
    );
  action(room, host, { type: 'reset', round: room.round });
  assert.throws(
    () => action(room, guest, { type: 'vote', value: '3', round: room.round }),
    hasCode('OBSERVER_CANNOT_VOTE'),
  );
  action(room, host, { type: 'setObserver', id: guest.id, value: false });
  action(room, guest, { type: 'vote', value: '3', round: room.round });
  assert.equal(guest.vote, '3');
  assert.equal(guest.observerLocked, false);
});

void test('removal revokes credentials and excludes a hidden vote from the room', () => {
  const { room, host, guest, guestToken, hostToken } = setup();
  action(room, guest, { type: 'vote', value: '8', round: room.round });
  action(room, host, { type: 'removeMember', id: guest.id });
  assert.throws(
    () => authenticate(room, guestToken),
    hasCode('REJOIN_REQUIRED'),
  );
  assert.equal(authenticate(room, hostToken).id, host.id);
  assert.equal(view(room, host).members.length, 1);
  assert.ok(!JSON.stringify(view(room, host)).includes(guest.secret));
});

void test('moderating the last pending voter completes automatic reveal; zero voters do not reveal', () => {
  for (const type of ['setObserver', 'removeMember']) {
    const { room, host, guest } = setup(true);
    action(room, host, { type: 'vote', value: '5', round: room.round });
    action(room, host, { type, id: guest.id, value: true });
    assert.equal(room.revealed, true);
    assert.equal(host.vote, '5');
  }
  const { room, host, guest } = setup(true);
  action(room, host, { type: 'spectator', value: true });
  action(room, host, { type: 'setObserver', id: guest.id, value: true });
  assert.equal(room.revealed, false);
});

void test('moderation also works after reveal and legacy observers remain voluntary', () => {
  const { room, host, guest } = setup();
  delete guest.observerLocked;
  action(room, guest, { type: 'spectator', value: true });
  action(room, guest, { type: 'spectator', value: false });
  action(room, guest, { type: 'vote', value: '8', round: room.round });
  action(room, host, { type: 'reveal', round: room.round });
  action(room, host, { type: 'setObserver', id: guest.id, value: true });
  action(room, host, { type: 'setObserver', id: guest.id, value: false });
  assert.equal(room.revealed, true);
  assert.equal(guest.vote, null);
  action(room, host, { type: 'removeMember', id: guest.id });
  assert.equal(room.members.length, 1);
});
