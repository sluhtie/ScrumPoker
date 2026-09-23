import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AVATARS,
  DEFAULT_AVATAR,
  savedAvatar,
  avatarImage,
} from '../lib/avatars.ts';
import { createRoom, member, action, view, GameError } from '../server/game.ts';

void test('selected avatars survive creation and are visible to other members', () => {
  const { room } = createRoom('Host', 'Avatar test', undefined, 'ghost');
  const guest = member('Guest', 'cat').member;
  room.members.push(guest);
  assert.equal(view(room, guest).members[0].avatar, 'ghost');
  assert.equal(view(room, room.members[0]).members[1].avatar, 'cat');
});

void test('avatar updates only affect the authenticated member and preserve the round', () => {
  const { room } = createRoom('Host', 'Avatar test', undefined, 'ghost');
  const host = room.members[0];
  const guest = member('Guest', 'cat').member;
  room.members.push(guest);
  action(room, host, { type: 'addStory', title: 'Test' });
  action(room, guest, { type: 'vote', value: '5', round: room.round });
  const round = room.round;
  action(room, guest, { type: 'avatar', avatar: 'robot', id: host.id });
  assert.equal(guest.avatar, 'robot');
  assert.equal(host.avatar, 'ghost');
  assert.equal(guest.vote, '5');
  assert.equal(room.round, round);
  assert.equal(view(room, host).members[1].vote, null);
});

void test('external URLs and unknown avatars are rejected without replacing a valid choice', () => {
  const { room } = createRoom('Host', 'Avatar test', undefined, 'frog');
  for (const value of [
    'https://evil.example/track',
    '../private',
    '__proto__',
    null,
    {},
    42,
  ]) {
    assert.throws(
      () => member('Guest', value),
      (e) => e instanceof GameError && e.code === 'INVALID_AVATAR',
    );
    assert.throws(() =>
      action(room, room.members[0], { type: 'avatar', avatar: value }),
    );
    assert.equal(room.members[0].avatar, 'frog');
    assert.equal(savedAvatar(value), DEFAULT_AVATAR);
    assert.equal(avatarImage(value), '/avatars/fox.webp');
  }
});

void test('legacy rooms and clients without an avatar keep working', () => {
  const { room } = createRoom('Host', 'Legacy room');
  delete room.members[0].avatar;
  assert.equal(view(room, room.members[0]).members[0].avatar, DEFAULT_AVATAR);
  for (const avatar of AVATARS)
    assert.equal(member('Guest', avatar).member.avatar, avatar);
});
