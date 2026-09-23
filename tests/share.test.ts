/* oxlint-disable typescript/no-floating-promises */
import assert from 'node:assert/strict';
import test from 'node:test';
import { shareMetadata, shareOrigin, shareRoomCode } from '../lib/share.ts';

test('share origins reject credentials, paths and non-web schemes', () => {
  assert.equal(
    shareOrigin('https://poker.example.com').href,
    'https://poker.example.com/',
  );
  for (const value of [
    'javascript:alert(1)',
    'https://user:secret@example.com',
    'https://example.com/path',
    'https://example.com/?room=secret',
    'https://example.com/#fragment',
  ]) {
    assert.throws(() => shareOrigin(value));
  }
});

test('only complete room codes are eligible for a title lookup', () => {
  assert.equal(shareRoomCode('abcdef123456'), 'ABCDEF123456');
  for (const value of [
    undefined,
    '',
    'ABC',
    '<script>',
    ['ABCDEF123456'],
    'ABCDEF123456&token=secret',
  ]) {
    assert.equal(shareRoomCode(value), null);
  }
});

test('home and room previews have separate artwork and stable absolute URLs', () => {
  const origin = shareOrigin('https://poker.example.com');
  const home = shareMetadata(origin, false, null, null);
  const room = shareMetadata(origin, true, 'ABCDEF123456', 'Team Rocket');
  assert.equal(home.robots.index, true);
  assert.equal(room.robots.index, false);
  assert.equal(room.title, 'Join Team Rocket · Planning Club');
  assert.equal(room.openGraph.title, room.twitter.title);
  assert.equal(room.openGraph.description, room.description);
  assert.equal(
    room.openGraph.url,
    'https://poker.example.com/?room=ABCDEF123456',
  );
  assert.equal(
    home.openGraph.images[0].url,
    'https://poker.example.com/og.png',
  );
  assert.equal(
    room.openGraph.images[0].url,
    'https://poker.example.com/og-invite.png',
  );
  assert.equal(room.twitter.images[0].url, room.openGraph.images[0].url);
});

test('missing and malformed rooms receive a generic invitation without indexing', () => {
  const metadata = shareMetadata(
    shareOrigin('https://poker.example.com'),
    true,
    null,
    null,
  );
  assert.equal(metadata.title, 'Your seat is ready · Planning Club');
  assert.equal(metadata.robots.index, false);
  assert.equal(metadata.alternates.canonical, 'https://poker.example.com/');
});
