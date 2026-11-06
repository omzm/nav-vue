import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const publicCategory = '11111111-1111-4111-8111-111111111111';
const privateCategory = '22222222-2222-4222-8222-222222222222';
const publicLink = '33333333-3333-4333-8333-333333333333';
const hiddenLink = '44444444-4444-4444-8444-444444444444';
const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

before(async () => {
  // Isolated PostgreSQL in memory. No .env, network, Supabase or production database.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    CREATE SCHEMA cron;
    CREATE TABLE cron.job(jobid serial PRIMARY KEY, jobname text, schedule text, command text);
    CREATE FUNCTION cron.schedule(text,text,text) RETURNS integer LANGUAGE sql AS $$ INSERT INTO cron.job(jobname,schedule,command) VALUES($1,$2,$3) RETURNING jobid $$;
    CREATE FUNCTION cron.unschedule(integer) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN DELETE FROM cron.job WHERE jobid=$1; RETURN FOUND; END $$;
  `);
  await db.exec(sql);
  await db.exec(sql); // Migration declarations must be repeatable.
  await db.exec(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;`);
  await db.query(
    `INSERT INTO categories(id,name,icon,is_private) VALUES ($1,'Public','',false),($2,'Hidden','',true)`,
    [publicCategory, privateCategory],
  );
  await db.query(
    `INSERT INTO links(id,category_id,title,url,description,"order",is_private)
    VALUES ($1,$2,'Public','https://one.example/','',9,false),($3,$4,'Hidden','https://hidden.example/','',1,false)`,
    [publicLink, publicCategory, hiddenLink, privateCategory],
  );
});
after(async () => {
  await db.close();
});

test('anonymous RLS excludes public-flagged links in private categories', async () => {
  await db.exec('SET ROLE anon');
  try {
    const result = await db.query('SELECT id FROM links ORDER BY id');
    assert.deepEqual(result.rows, [{ id: publicLink }]);
    const snapshot = await db.query<{
      data: { categories: Array<{ links: unknown[] }>; stats: { linkCount: number } };
    }>('SELECT get_nav_snapshot_data() AS data');
    assert.equal(snapshot.rows[0].data.stats.linkCount, 1);
    assert.equal(snapshot.rows[0].data.categories.flatMap((c) => c.links).length, 1);
    await assert.rejects(
      db.query("SELECT consume_rate_limit('forbidden',10,1000)"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("SELECT admin_reorder_items('links', ARRAY[]::uuid[])"),
      /permission denied/,
    );
    await assert.rejects(db.query('SELECT bump_nav_snapshot_version()'), /permission denied/);
  } finally {
    await db.exec('RESET ROLE');
  }
});

test('one-statement sliding window admits exactly the configured number of attempts', async () => {
  const results = await Promise.all(
    Array.from({ length: 25 }, () =>
      db.query<{ allowed: boolean }>("SELECT consume_rate_limit('parallel',10,600000) AS allowed"),
    ),
  );
  assert.equal(results.filter((r) => r.rows[0].allowed).length, 10);
  assert.equal(
    (
      await db.query<{ n: number }>(
        "SELECT cardinality(hits) AS n FROM rate_limit_windows WHERE key='parallel'",
      )
    ).rows[0].n,
    10,
  );
});

test('ordering and cascade operations roll back completely on failure', async () => {
  const before = await db.query('SELECT id,"order" FROM links ORDER BY id');
  await assert.rejects(
    db.query("SELECT admin_reorder_items('links', $1::uuid[])", [
      [publicLink, '55555555-5555-4555-8555-555555555555'],
    ]),
  );
  assert.deepEqual((await db.query('SELECT id,"order" FROM links ORDER BY id')).rows, before.rows);
  await db.query("SELECT admin_reorder_items('links', $1::uuid[])", [[publicLink, hiddenLink]]);
  assert.equal(
    (await db.query<{ order: number }>('SELECT "order" FROM links WHERE id=$1', [hiddenLink]))
      .rows[0].order,
    2,
  );
  await db.query('SELECT admin_update_category($1,$2,$3,$4,$5,$6)', [
    privateCategory,
    'Hidden',
    '',
    0,
    true,
    true,
  ]);
  assert.equal(
    (
      await db.query<{ is_private: boolean }>('SELECT is_private FROM links WHERE id=$1', [
        hiddenLink,
      ])
    ).rows[0].is_private,
    true,
  );
});

test('batch move preserves all original rows when one ID is missing', async () => {
  await assert.rejects(
    db.query('SELECT admin_move_links($1::uuid[],$2)', [
      [publicLink, '55555555-5555-4555-8555-555555555555'],
      privateCategory,
    ]),
  );
  assert.equal(
    (
      await db.query<{ category_id: string }>('SELECT category_id FROM links WHERE id=$1', [
        publicLink,
      ])
    ).rows[0].category_id,
    publicCategory,
  );
});

test('public submission serializes duplicate checks and appends after max order', async () => {
  await db.query('UPDATE links SET "order"=40 WHERE id=$1', [publicLink]);
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      db.query<{ result: string }>('SELECT submit_public_link($1,$2,$3,$4) AS result', [
        publicCategory,
        'New',
        'https://new.example',
        '',
      ]),
    ),
  );
  assert.equal(results.filter((r) => r.rows[0].result === 'ok').length, 1);
  assert.equal(results.filter((r) => r.rows[0].result === 'duplicate').length, 4);
  assert.equal(
    (
      await db.query<{ order: number }>(
        'SELECT "order" FROM links WHERE url=\'https://new.example\'',
      )
    ).rows[0].order,
    41,
  );
});

test('cache revision changes after writes and manual refresh', async () => {
  const read = async () =>
    (await db.query<{ v: string }>('SELECT get_nav_snapshot_version() AS v')).rows[0].v;
  const before = await read();
  await db.query('UPDATE categories SET name=name WHERE id=$1', [publicCategory]);
  assert.notEqual(await read(), before);
  const second = await read();
  await db.exec('SELECT bump_nav_snapshot_version()');
  assert.notEqual(await read(), second);
});

test('session revocation uses compare-and-swap to reject stale account updates', async () => {
  const r = await db.query<{ ok: boolean }>(
    "SELECT begin_admin_account_change('0','revision-1') AS ok",
  );
  assert.equal(r.rows[0].ok, true);
  assert.equal(
    (await db.query<{ ok: boolean }>("SELECT begin_admin_account_change('0','revision-2') AS ok"))
      .rows[0].ok,
    false,
  );
});

test('Shanghai cleanup retains current-day clicks under a UTC database session', async () => {
  await db.exec("SET TIME ZONE 'UTC'");
  const jobs = await db.query<{ schedule: string; command: string }>(
    "SELECT schedule, command FROM cron.job WHERE jobname='clean-old-link-clicks'",
  );
  assert.equal(jobs.rows.length, 1);
  assert.equal(jobs.rows[0].schedule, '5 16 * * *');
  await db.query(
    "INSERT INTO link_clicks(link_id,clicked_at) VALUES($1,date_trunc('day',now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' + interval '1 minute'),($1,now()-interval '2 days')",
    [publicLink],
  );
  await db.exec(jobs.rows[0].command);
  assert.equal(
    (await db.query<{ n: number }>('SELECT count(*)::integer AS n FROM link_clicks')).rows[0].n,
    1,
  );
});
