import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';

// Force fixtures before importing env.ts; never load the production .env.
Object.assign(process.env, {
  SUPABASE_URL: 'https://database.example.test',
  SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  ADMIN_SESSION_SECRET: 'fixture-secret-for-tests-only',
  SUBMIT_PASSWORD: 'fixture-submit',
  NODE_ENV: 'test',
  SITE_URL: '',
});
const nativeFetch = globalThis.fetch;
const config = new Map<string, string>();
let failAuth = false,
  failConfig = false,
  failLimiter = false,
  exhausted = false;
let passwordUpdates = 0,
  writes = 0,
  revision = '1',
  snapshotReads = 0;
let releaseSnapshot: (() => void) | null = null;
let pauseSnapshot = false;
const categoryId = '11111111-1111-4111-8111-111111111111';
const user = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'admin@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
};
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname === '127.0.0.1') return nativeFetch(input, init);
  if (url.origin !== 'https://database.example.test')
    throw new Error('Tests refuse external requests');
  const method = init.method ?? 'GET';
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
  if (url.pathname === '/rest/v1/app_config') {
    if (method === 'GET') return json([...config].map(([key, value]) => ({ key, value })));
    if (failConfig) return json({ message: 'fixture write failure' }, 500);
    for (const row of Array.isArray(body) ? body : [body]) config.set(row.key, row.value);
    writes++;
    return new Response(null, { status: 204 });
  }
  if (url.pathname === '/rest/v1/rpc/consume_rate_limit')
    return failLimiter ? json({ message: 'unavailable' }, 500) : json(!exhausted);
  if (url.pathname === '/rest/v1/rpc/begin_admin_account_change') {
    if (body.p_expected_version !== (config.get('admin_session_version') || '0'))
      return json(false);
    config.set('admin_session_version', body.p_new_version);
    return json(true);
  }
  if (url.pathname === '/auth/v1/token')
    return json({
      access_token: 'fixture-access',
      refresh_token: 'fixture-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      user,
    });
  if (url.pathname.startsWith('/auth/v1/admin/users/')) {
    if (failAuth) return json({ message: 'fixture password rejection' }, 500);
    if (body?.password) passwordUpdates++;
    return json({ ...user, ...(body?.email ? { email: body.email } : {}) });
  }
  if (url.pathname === '/rest/v1/rpc/get_nav_snapshot_version') return json(revision);
  if (url.pathname === '/rest/v1/rpc/get_nav_snapshot_data') {
    snapshotReads++;
    const captured = revision;
    if (pauseSnapshot)
      await new Promise<void>((resolve) => {
        releaseSnapshot = resolve;
      });
    return json({
      categories: [{ id: captured, name: 'Fixture', icon: '', links: [] }],
      hotLinks: [],
      stats: { categoryCount: 1, linkCount: 0, totalViewCount: 0 },
      generatedAt: new Date().toISOString(),
    });
  }
  if (url.pathname === '/rest/v1/categories' || url.pathname === '/rest/v1/links') {
    if (method !== 'GET') {
      writes++;
      return json({ id: categoryId });
    }
    const count = url.pathname.endsWith('/links') ? 1201 : 1;
    const offset = Number(url.searchParams.get('offset') || 0),
      limit = Number(url.searchParams.get('limit') || 500);
    const data = Array.from({ length: Math.max(0, Math.min(limit, count - offset)) }, (_, i) => ({
      id: String(offset + i),
      order: offset + i,
    }));
    return json(data, 200, {
      'content-range': offset + '-' + (offset + data.length - 1) + '/' + count,
    });
  }
  throw new Error('Unhandled fixture ' + url.pathname);
};

const { createApp } = await import('../server/src/app.js');
const { signAdminToken } = await import('../server/src/lib/adminAuth.js');
const { invalidateSnapshot, getSnapshot } = await import('../server/src/lib/snapshot.js');
const { isRateLimitedDb } = await import('../server/src/lib/rateLimitDb.js');
const { normalizeUrl } = await import('../server/src/lib/url.js');
const { assertPublicHttpUrl, isPublicAddress, createPublicFetcher } =
  await import('../server/src/lib/publicHttp.js');
const { readJsonBounded } = await import('../server/src/lib/aiClient.js');
let server: Server, origin: string;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  globalThis.fetch = nativeFetch;
});
beforeEach(() => {
  config.clear();
  config.set('admin_email', 'admin@example.test');
  config.set('admin_username', 'admin');
  config.set('admin_session_version', '0');
  failAuth = false;
  failConfig = false;
  failLimiter = false;
  exhausted = false;
  passwordUpdates = 0;
  writes = 0;
  revision = '1';
  snapshotReads = 0;
  pauseSnapshot = false;
  releaseSnapshot = null;
  invalidateSnapshot();
});
async function call(
  path: string,
  body?: unknown,
  cookie = signAdminToken('admin@example.test'),
  method = body ? 'POST' : 'GET',
) {
  const res = await nativeFetch(origin + path, {
    method,
    headers: { 'content-type': 'application/json', cookie: 'nav_admin=' + cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json(), headers: res.headers };
}

test('password changes revoke existing cookies and issue a working new session', async () => {
  const oldCookie = signAdminToken('admin@example.test');
  const result = await call(
    '/api/admin/account/profile',
    { username: 'admin', currentPassword: 'old-password', newPassword: 'new-password' },
    oldCookie,
    'PUT',
  );
  assert.equal(result.status, 200);
  assert.equal(passwordUpdates, 1);
  assert.equal((await call('/api/admin/account', undefined, oldCookie)).status, 401);
  const newCookie = result.headers.get('set-cookie')!.match(/nav_admin=(v2\.[^; ,]+)/)![1];
  assert.equal((await call('/api/admin/account', undefined, newCookie)).status, 200);
});
test('a failed password update leaves the username unchanged', async () => {
  failAuth = true;
  const result = await call(
    '/api/admin/account/profile',
    { username: 'changed', currentPassword: 'old-password', newPassword: 'new-password' },
    undefined,
    'PUT',
  );
  assert.equal(result.status, 500);
  assert.equal(config.get('admin_username'), 'admin');
});
test('failed config commit compensates the authentication update', async () => {
  failConfig = true;
  const result = await call(
    '/api/admin/account/profile',
    { username: 'changed', currentPassword: 'old-password', newPassword: 'new-password' },
    undefined,
    'PUT',
  );
  assert.equal(result.status, 500);
  assert.equal(passwordUpdates, 2);
  assert.equal(config.get('admin_username'), 'admin');
  assert.match(result.data.error, /还原/);
});
test('status rejects cookies for an obsolete administrator', async () => {
  const cookie = signAdminToken('previous@example.test');
  assert.equal((await call('/api/auth/status', undefined, cookie)).data.sessionEmail, null);
  assert.equal((await call('/api/admin/account', undefined, cookie)).status, 401);
});
test('submission quota is checked before comparing either password', async () => {
  exhausted = true;
  assert.equal((await call('/api/submit', { password: 'wrong' })).status, 429);
  assert.equal((await call('/api/submit', { password: 'fixture-submit' })).status, 429);
});
test('limiter storage errors fail closed', async () => {
  failLimiter = true;
  assert.equal(await isRateLimitedDb('fixture', 10, 1000), true);
});
test('admin API rejects non-HTTP URLs, malformed IDs, booleans and orders before writing', async () => {
  for (const payload of [
    { category_id: categoryId, title: 'Test', url: 'javascript:alert(1)' },
    { category_id: 'invalid', title: 'Test', url: 'https://example.test' },
    { category_id: categoryId, title: 'Test', url: 'https://example.test', is_private: 'false' },
    { category_id: categoryId, title: 'Test', url: 'https://example.test', order: 1.5 },
  ])
    assert.equal((await call('/api/admin/links', payload)).status, 400);
  assert.equal((await call('/api/admin/links/batch-delete', { ids: ['invalid'] })).status, 400);
  assert.equal(writes, 0);
});
test('admin dataset is not truncated at the PostgREST default row limit', async () => {
  const result = await call('/api/admin/data');
  assert.equal(result.status, 200);
  assert.equal(result.data.links.length, 1201);
});
test('late snapshot results cannot overwrite an invalidated cache', async () => {
  pauseSnapshot = true;
  const pending = getSnapshot();
  while (!releaseSnapshot) await new Promise((resolve) => setTimeout(resolve, 1));
  revision = '2';
  invalidateSnapshot();
  pauseSnapshot = false;
  releaseSnapshot!();
  await pending;
  assert.equal((await getSnapshot()).categories[0].id, '2');
  assert.equal(snapshotReads, 2);
  revision = '3';
  assert.equal((await getSnapshot()).categories[0].id, '3');
});
test('public snapshots are not retained by shared HTTP caches', async () => {
  assert.equal((await call('/api/snapshot')).headers.get('cache-control'), 'no-store');
});
test('SEO ignores forged forwarded headers and emits no attacker markup', async () => {
  const response = await nativeFetch(origin + '/sitemap.xml', {
    headers: { 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https</loc><attack>' },
  });
  const xml = await response.text();
  assert.ok(!xml.includes('attacker.example'));
  assert.ok(!xml.includes('<attack>'));
});
test('malformed JSON and unsupported local login return safe errors', async () => {
  const response = await nativeFetch(origin + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.match(response.headers.get('content-type')!, /json/);
  assert.equal((await call('/api/auth/local-login', {})).status, 404);
});
test('URL normalization preserves slashes inside query values and fragments', () => {
  assert.equal(
    normalizeUrl('https://EXAMPLE.test/?next=https://destination.test/'),
    'https://example.test/?next=https://destination.test/',
  );
  assert.equal(normalizeUrl('https://example.test/path/#/'), 'https://example.test/path#/');
  assert.equal(normalizeUrl('https://EXAMPLE.test/'), 'https://example.test');
});
test('public HTTP validation rejects private, mapped, link-local, multicast and credential URLs', () => {
  for (const url of [
    'http://169.254.169.254/',
    'http://[fc00::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://localhost./',
    'http://127.1/',
    'http://10.0.0.1/',
    'http://user:pass@example.com/',
    'http://[fe80::1]/',
    'http://224.0.0.1/',
  ])
    assert.throws(() => assertPublicHttpUrl(url), url);
  assert.equal(isPublicAddress('127.0.0.1'), false);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assertPublicHttpUrl('https://example.com/path');
});
test('bounded AI JSON reader cancels an oversized streamed response', async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(100));
      },
      cancel() {
        cancelled = true;
      },
    }),
  );
  await assert.rejects(readJsonBounded(response, 10), /过大/);
  assert.equal(cancelled, true);
});
test('production migration with an empty connection string fails before accessing any database', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync(process.execPath, ['server/scripts/migrate.mjs'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: '', MIGRATE_ENV: 'production' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL/);
});

test('DNS answers and redirect destinations are checked before making a request', async () => {
  let calls = 0;
  const send = (async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } });
  }) as unknown as Parameters<typeof createPublicFetcher>[1];
  const mixed = createPublicFetcher(
    async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ],
    send,
  );
  await assert.rejects(mixed('https://example.com'), /非公网/);
  assert.equal(calls, 0);
  const redirect = createPublicFetcher(async () => [{ address: '8.8.8.8', family: 4 }], send);
  await assert.rejects(redirect('https://example.com', {}, 3), /本地|内网/);
  assert.equal(calls, 1);
});
test('a stalled DNS lookup can be aborted without opening a connection', async () => {
  const fetcher = createPublicFetcher(() => new Promise(() => {}));
  const controller = new AbortController();
  const request = fetcher('https://example.com', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, (error) => (error as Error).name === 'AbortError');
});
test('preloading root .env preserves injected environment variables', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      './server/scripts/load-env.mjs',
      '--input-type=module',
      '-e',
      "console.log(process.env.SUPABASE_URL === 'https://fixture.invalid')",
    ],
    {
      cwd: root,
      env: { ...process.env, SUPABASE_URL: 'https://fixture.invalid' },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'true');
});
