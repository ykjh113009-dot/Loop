const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = (q) => execSync(`psql ${DB} -qtAc "${q}"`).toString().trim();
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
async function signIn(browser, email, vp = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator(`input[value="${email}"]`) }).locator('button').click();
  await p.waitForURL(/\/(home|application-update)/);
  return { ctx, p };
}
(async () => {
  const b = await chromium.launch();
  // A student cannot use the page or the database functions behind it.
  const s = await signIn(b, 'demo.layla@pioneers.edu.ps');
  await s.p.goto(BASE + '/admin/content', { waitUntil: 'networkidle' });
  const sBody = await s.p.locator('body').innerText();
  check('A student does not get the admin content feed', !/Remove…|Everything/.test(sBody) && !s.p.url().endsWith('/admin/content') || /not allowed|Home|denied/i.test(sBody), s.p.url());
  await s.ctx.close();

  const listing = sql("select id from listings order by created_at limit 1");
  const title = sql(`select title from listings where id = '${listing}'`);
  const owner = sql(`select seller_id from listings where id = '${listing}'`);
  const a = await signIn(b, 'demo.rania@pioneers.edu.ps');
  const p = a.p;
  await p.goto(BASE + '/admin/content', { waitUntil: 'networkidle' });
  check('Admin sees the Content tab in the admin menu', (await p.locator('a[href="/admin/content"]').count()) > 0);
  check('Everything feed lists items from several kinds', (await p.locator('[data-content-row]').evaluateAll((r) => new Set(r.map((x) => x.getAttribute('data-content-row'))).size)) >= 2);
  for (const [tab, kind] of [['Clubs', 'club'], ['Marketplace', 'listing'], ['Events', 'event'], ['Polls', 'poll'], ['Posts', 'post']]) {
    await p.getByRole('navigation', { name: 'Kinds of content' }).getByRole('link', { name: tab, exact: true }).click();
    await p.waitForURL(new RegExp(`kind=${kind}`));
    await p.waitForSelector(`[data-content-row="${kind}"]`);
    const kinds = await p.locator('[data-content-row]').evaluateAll((r) => [...new Set(r.map((x) => x.getAttribute('data-content-row')))]);
    check(`${tab} tab shows only ${kind} items`, kinds.length === 1 && kinds[0] === kind, kinds.join(','));
  }
  await p.goto(BASE + '/admin/content?kind=listing', { waitUntil: 'networkidle' });
  const row = p.locator('[data-content-row=listing]', { hasText: title }).first();
  await row.locator('summary').click();
  await row.getByRole('button', { name: 'Remove for good' }).click();
  await p.waitForTimeout(800);
  check('Removing without a reason is refused by the form', sql(`select count(*) from listings where id = '${listing}'`) === '1');
  await row.getByLabel('Reason for removing').fill('Selling things that are not allowed');
  await row.getByRole('button', { name: 'Remove for good' }).click();
  await p.waitForFunction((t) => !document.body.innerText.includes(t), title, { timeout: 15000 }).catch(() => {});
  check('The listing is deleted from the database', sql(`select count(*) from listings where id = '${listing}'`) === '0');
  check('The removal is in the activity log with the reason', Number(sql(`select count(*) from moderation_log where action = 'remove_listing' and details like '%not allowed%'`)) === 1);
  check('The seller is told why', Number(sql(`select count(*) from notifications where recipient_id = '${owner}' and kind = 'removed' and body like '%not allowed%'`)) === 1);
  await p.goto(BASE + '/admin/content?kind=listing', { waitUntil: 'networkidle' });
  check('It disappears from the feed after a refresh', !(await p.locator('body').innerText()).includes(title));
  // phone layout
  await a.ctx.close();
  const m = await signIn(b, 'demo.rania@pioneers.edu.ps', { width: 390, height: 844 });
  await m.p.goto(BASE + '/admin/content', { waitUntil: 'networkidle' });
  check('No sideways scrolling on a phone', await m.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await b.close();
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
