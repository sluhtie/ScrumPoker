import assert from 'node:assert/strict';
import pg from 'pg';

const base = process.env.TEST_ORIGIN || 'http://localhost:3000';
const publicOrigin = new URL(process.env.APP_ORIGIN || base).origin;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const codes = [];
function decode(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
async function preview(path) {
  const response = await fetch(base + path, {
    headers: {
      'User-Agent': 'facebookexternalhit/1.1',
      'X-Forwarded-Host': 'untrusted.example',
    },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  const tags = {};
  for (const match of html.matchAll(
    /<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"/g,
  ))
    tags[match[1]] = decode(match[2]);
  assert.ok(!html.includes('https://untrusted.example'));
  assert.equal(tags['twitter:card'], 'summary_large_image');
  assert.equal(tags['og:title'], tags['twitter:title']);
  assert.equal(tags.description, tags['og:description']);
  assert.equal(tags['og:description'], tags['twitter:description']);
  assert.equal(tags['og:image'], tags['twitter:image']);
  assert.equal(tags['og:image:width'], '1734');
  assert.equal(tags['og:image:height'], '907');
  return { html, tags };
}
try {
  const home = await preview('/');
  assert.equal(home.tags['og:image'], publicOrigin + '/og.png');
  assert.match(home.tags.robots, /index, follow/);
  for (const title of [
    'Rocket team · Sprint 24',
    'Équipe <script>alert("x")</script> & friends',
  ]) {
    const response = await fetch(base + '/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, name: 'PRIVATE participant name' }),
    });
    assert.equal(response.status, 201);
    const { code, token } = await response.json();
    codes.push(code);
    const { html, tags } = await preview('/?room=' + code.toLowerCase());
    assert.equal(tags['og:title'], `Join ${title} · Planning Club`);
    assert.equal(tags['og:url'], publicOrigin + '/?room=' + code);
    assert.equal(tags['og:image'], publicOrigin + '/og-invite.png');
    assert.match(tags.robots, /noindex/);
    assert.ok(!html.includes('PRIVATE participant name'));
    assert.ok(!html.includes(token));
    assert.ok(!html.includes('<script>alert("x")</script>'));
  }
  for (const path of ['/?room=BAD', '/?room=000000000000']) {
    const { tags } = await preview(path);
    assert.equal(tags['og:title'], 'Your seat is ready · Planning Club');
    assert.match(tags.robots, /noindex/);
  }
  for (const path of ['/og.png', '/og-invite.png']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1734);
    assert.equal(png.readUInt32BE(20), 907);
  }
  console.log(
    'PASS: homepage, two room previews, title escaping, private-data exclusion, missing rooms, trusted origin, and both public PNG images',
  );
} finally {
  for (const code of codes)
    await db.query('DELETE FROM poker_rooms WHERE code=$1', [code]);
  await db.end();
}
