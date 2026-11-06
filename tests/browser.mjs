import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { chromium } from 'playwright';

const app = express();
const dist = fileURLToPath(new URL('../client/dist/', import.meta.url));
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(dist + 'index.html'));
let server, browser, origin;
const categoryId = '11111111-1111-4111-8111-111111111111';
const linkId = '22222222-2222-4222-8222-222222222222';
const category = {
  id: categoryId,
  name: 'Tools',
  icon: '📁',
  order: 1,
  is_private: false,
  created_at: '2026-01-01T00:00:00Z',
};
const link = {
  id: linkId,
  category_id: categoryId,
  title: 'Example',
  url: 'https://example.test',
  description: 'Fixture',
  icon: 'https://image.example.test/icon.png',
  order: 9,
  is_private: false,
  created_at: category.created_at,
};
const publicCategory = {
  id: categoryId,
  name: 'Tools',
  icon: '📁',
  order: 1,
  isPrivate: false,
  links: [{ id: linkId, title: 'Example', url: link.url, description: 'Fixture' }],
};
const privateCategory = {
  ...publicCategory,
  links: [
    {
      id: 'private-link',
      title: 'Private',
      url: 'https://private.example.test',
      description: 'Fixture',
      isPrivate: true,
    },
  ],
};
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGQAAAABJRU5ErkJggg==',
  'base64',
);
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'],
  });
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
});

async function fixture(t, options = {}) {
  const state = {
    loggedIn: true,
    configured: true,
    phrase: '开门',
    loginFails: false,
    logoutFails: false,
    dataFails: false,
    unlockDelay: 0,
    privateEmpty: false,
    icon: '📁',
    ...options,
  };
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const calls = [],
    external = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.origin !== origin) {
      external.push(url.href);
      return route.fulfill(
        req.resourceType() === 'image'
          ? { status: 200, contentType: 'image/png', body: pixel }
          : { status: 200, body: '' },
      );
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const path = url.pathname.slice(4),
      body = req.postDataJSON() ?? {};
    calls.push({ path, method: req.method(), body });
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path === '/auth/status')
      return json({
        configured: state.configured,
        sessionEmail: state.loggedIn ? 'admin@example.test' : null,
      });
    if (path === '/auth/config-status')
      return json({ status: state.configured ? 'configured' : 'not-configured' });
    if (path === '/auth/login') {
      if (state.loginFails) return json({ error: '账号或密码不正确' }, 401);
      state.loggedIn = true;
      return json({ ok: true });
    }
    if (path === '/auth/logout') {
      if (state.logoutFails) return json({ error: '模拟服务失败' }, 500);
      state.loggedIn = false;
      return json({ ok: true });
    }
    if (path === '/admin/data')
      return state.dataFails
        ? json({ error: '模拟加载失败' }, 500)
        : json({ categories: [category], links: [link] });
    if (path === '/admin/account') return json({ email: 'admin@example.test', username: 'admin' });
    if (path === '/snapshot')
      return json({
        categories: [{ ...publicCategory, icon: state.icon }],
        hotLinks: [],
        stats: { categoryCount: 1, linkCount: 1, totalViewCount: 0 },
        generatedAt: category.created_at,
      });
    if (path === '/submit/config') return json({ enabled: false, categories: [] });
    if (path === '/daily-quote') return json({ quote: 'Test' });
    if (path === '/bing-wallpaper')
      return route.fulfill({ status: 200, contentType: 'image/png', body: pixel });
    if (path === '/unlock') {
      const ok = body.phrase === state.phrase;
      if (state.unlockDelay) await new Promise((resolve) => setTimeout(resolve, state.unlockDelay));
      return json({
        ok,
        categories: ok && !state.privateEmpty ? [privateCategory] : [],
        reason: ok ? undefined : 'mismatch',
      });
    }
    if (path === '/admin/links/check-duplicate') return json({ duplicate: null });
    if (
      path === '/site-view' ||
      path === '/link-click' ||
      path === '/admin/refresh-snapshot' ||
      path.startsWith('/admin/categories') ||
      path.startsWith('/admin/links')
    )
      return json({ ok: true });
    throw new Error('Unhandled mock API ' + path);
  });
  t.after(async () => {
    assert.deepEqual(errors, []);
    await context.close();
  });
  return { page, state, calls, external };
}

test('login errors are visible and form labels target the real controls', async (t) => {
  const { page } = await fixture(t, { loggedIn: false, loginFails: true });
  await page.goto(origin + '/admin');
  await page.getByLabel('账号', { exact: true }).fill('admin@example.test');
  await page.getByLabel('登录密码', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: '登录工作台' }).click();
  await page.getByText('账号或密码不正确', { exact: true }).waitFor();
  assert.equal(await page.locator('[role="status"]').count(), 1);
});
test('the recovery form remains accessible after administrator configuration', async (t) => {
  const { page } = await fixture(t, { loggedIn: false });
  await page.goto(origin + '/admin/setup');
  await page.getByRole('heading', { name: '初始化管理员' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/admin/setup');
});
test('one-character phrases work and merge links into their existing category', async (t) => {
  const { page, calls } = await fixture(t, { loggedIn: false, phrase: '门' });
  await page.goto(origin);
  await page.locator('#search-input').fill('门');
  await page.getByText('隐私模式已开启', { exact: true }).waitFor();
  assert.equal(await page.locator('[id="category-' + categoryId + '"]').count(), 1);
  assert.equal(calls.filter((c) => c.path === '/unlock').length, 1);
  await page.getByText('Private', { exact: true }).waitFor();
});
test('a delayed unlock cannot reopen privacy mode after clearing search', async (t) => {
  const { page, calls } = await fixture(t, { loggedIn: false, unlockDelay: 600 });
  await page.goto(origin);
  await page.locator('#search-input').fill('开门');
  await page.waitForRequest((r) => r.url().endsWith('/api/unlock'));
  await page.locator('#search-input').fill('');
  await page.waitForTimeout(800);
  assert.equal(calls.filter((c) => c.path === '/unlock').length, 1);
  assert.equal(await page.getByText('隐私模式已开启', { exact: true }).count(), 0);
});
test('rapid typing is debounced into one unlock attempt', async (t) => {
  const { page, calls } = await fixture(t, { loggedIn: false });
  await page.goto(origin);
  await page.locator('#search-input').pressSequentially('randomphrase', { delay: 20 });
  await page.waitForTimeout(400);
  assert.equal(calls.filter((c) => c.path === '/unlock').length, 1);
});
test('login invalidates a cached negative administrator hint', async (t) => {
  const { page, state } = await fixture(t, { loggedIn: false });
  await page.goto(origin + '/admin');
  await page.evaluate(() => sessionStorage.setItem('nav_admin_hint', '0'));
  await page.getByLabel('账号', { exact: true }).fill('admin@example.test');
  await page.getByLabel('登录密码', { exact: true }).fill('password');
  await page.getByRole('button', { name: '登录工作台' }).click();
  await page.waitForURL(origin + '/admin/dashboard');
  await page.goto(origin);
  await page.getByRole('button', { name: '刷新页面', exact: true }).waitFor();
  assert.equal(state.loggedIn, true);
});
test('link icon previews load while a spinner is displayed', async (t) => {
  const { page, external } = await fixture(t);
  await page.goto(origin + '/admin/dashboard/link/' + linkId);
  const img = page.locator('img[src="' + link.icon + '"]');
  await img.waitFor({ state: 'visible' });
  assert.equal(await img.evaluate((i) => i.complete && i.naturalWidth > 0), true);
  assert.ok(external.includes(link.icon));
});
test('leaving a pending category dialog cancels writes', async (t) => {
  const { page, calls } = await fixture(t);
  await page.goto(origin + '/admin/dashboard/categories');
  await page.getByRole('button', { name: '编辑 Tools', exact: true }).click();
  await page.getByRole('switch', { name: '设为私密分类' }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.goBack();
  await page.waitForTimeout(350);
  assert.equal(
    calls.filter((c) => ['PUT', 'DELETE'].includes(c.method) || c.path === '/admin/categories')
      .length,
    0,
  );
});
test('category confirmation updates the original ID exactly once', async (t) => {
  const { page, calls } = await fixture(t);
  await page.goto(origin + '/admin/dashboard/category/' + categoryId);
  await page.getByRole('switch', { name: '设为私密分类' }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '同步设为私密', exact: true }).click();
  await page.waitForURL(origin + '/admin/dashboard/categories');
  const writes = calls.filter((c) => c.method === 'PUT');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, '/admin/categories/' + categoryId);
  assert.equal(writes[0].body.syncLinksPrivate, true);
});
test('logout failure keeps the current screen and displays failure', async (t) => {
  const { page, state } = await fixture(t, { logoutFails: true });
  await page.goto(origin + '/admin/dashboard');
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '退出', exact: true }).click();
  await page.getByText('退出登录失败，请重试', { exact: true }).waitFor();
  assert.equal(state.loggedIn, true);
  assert.equal(await page.getByText('已退出登录', { exact: true }).count(), 0);
  assert.equal(new URL(page.url()).pathname, '/admin/dashboard');
});
test('data failures are shown explicitly and never claim a successful sync', async (t) => {
  const { page } = await fixture(t, { dataFails: true });
  await page.goto(origin + '/admin/dashboard/categories');
  await page.getByText('数据加载失败', { exact: true }).waitFor();
  assert.equal(await page.getByText('暂无分类', { exact: true }).count(), 0);
  assert.equal((await page.locator('body').innerText()).includes('数据已同步 · 刚刚刷新'), false);
});
test('SVG animation and links are stripped before rendering', async (t) => {
  const icon =
    '<svg xmlns="http://www.w3.org/2000/svg"><a><animate attributeName="href" values="javascript:window.__svgAudit=1" dur="1ms" fill="freeze"/><text x="10" y="30">LocalAudit</text></a><path d="M0 0h10" onload="window.__svgAudit=1"/></svg>';
  const { page } = await fixture(t, { icon });
  await page.goto(origin);
  await page.getByText('LocalAudit', { exact: true }).first().waitFor();
  assert.equal(
    await page
      .locator('.category-svg-icon animate, .category-svg-icon a, .category-svg-icon [onload]')
      .count(),
    0,
  );
  await page.getByText('LocalAudit', { exact: true }).first().click();
  assert.equal(await page.evaluate(() => window.__svgAudit === 1), false);
});
test('dialog keyboard focus wraps within the modal', async (t) => {
  const { page } = await fixture(t);
  await page.goto(origin + '/admin/dashboard');
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('button', { name: '退出', exact: true }).focus();
  await page.keyboard.press('Tab');
  assert.equal(
    await dialog
      .getByRole('button', { name: '关闭', exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
});
test('navigation reuses fresh admin data instead of loading it again on each page', async (t) => {
  const { page, calls } = await fixture(t);
  await page.goto(origin + '/admin/dashboard/categories');
  await page.getByRole('button', { name: '编辑 Tools', exact: true }).click();
  await page.getByRole('heading', { name: '编辑分类', exact: true }).waitFor();
  assert.equal(calls.filter((c) => c.path === '/admin/data').length, 1);
});

test('reopening privacy mode uses an empty fresh result instead of deleted cached links', async (t) => {
  const { page, state } = await fixture(t, { loggedIn: false });
  await page.goto(origin);
  await page.locator('#search-input').fill('开门');
  await page.getByText('Private', { exact: true }).waitFor();
  await page.getByRole('button', { name: '退出隐私模式', exact: true }).click();
  state.privateEmpty = true;
  await page.locator('#search-input').fill('开门');
  await page.getByText('隐私模式已开启', { exact: true }).waitFor();
  assert.equal(await page.getByText('Private', { exact: true }).count(), 0);
});
