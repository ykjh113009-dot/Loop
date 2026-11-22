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
const tab = (p, name) => p.getByRole('navigation', { name: 'Kinds of content' }).getByRole('link', { name, exact: true });
(async () => {
  const b = await chromium.launch();

  // A student cannot use the page.
  const s = await signIn(b, 'demo.layla@pioneers.edu.ps');
  await s.p.goto(BASE + '/admin/content', { waitUntil: 'networkidle' });
  check('A student does not get the content page', s.p.url().endsWith('/home') && !/Recently removed/.test(await s.p.locator('body').innerText()), s.p.url());
  await s.ctx.close();

  // A moderator can hide posts but not clubs, and cannot delete for good.
  const mo = await signIn(b, 'demo.omar@pioneers.edu.ps');
  await mo.p.goto(BASE + '/admin/content?kind=post', { waitUntil: 'networkidle' });
  check('A moderator sees posts with Hide', (await mo.p.locator('[data-content-row=post] summary', { hasText: 'Hide…' }).count()) > 0);
  check('A moderator gets no Edit and no Delete for good', (await mo.p.locator('summary', { hasText: /Edit…|Delete for good…/ }).count()) === 0);
  await mo.p.goto(BASE + '/admin/content?kind=club', { waitUntil: 'networkidle' });
  check('A moderator cannot hide clubs', (await mo.p.locator('[data-content-row=club]').count()) > 0 && (await mo.p.locator('summary', { hasText: 'Hide…' }).count()) === 0);
  await mo.ctx.close();

  // The Super Admin: hide, find it under Recently removed, restore, hide again, delete for good with confirmation.
  const listing = sql("select id from listings order by created_at limit 1");
  const title = sql(`select title from listings where id = '${listing}'`);
  const owner = sql(`select seller_id from listings where id = '${listing}'`);
  const a = await signIn(b, 'demo.rania@pioneers.edu.ps');
  const p = a.p;
  await p.goto(BASE + '/admin/content', { waitUntil: 'networkidle' });
  check('Admin menu has the Content tab', (await p.locator('a[href="/admin/content"]').count()) > 0);
  check('Everything lists several kinds', (await p.locator('[data-content-row]').evaluateAll((r) => new Set(r.map((x) => x.getAttribute('data-content-row'))).size)) >= 2);
  for (const [name, kind] of [['Clubs', 'club'], ['Marketplace', 'listing'], ['Events', 'event'], ['Polls', 'poll'], ['Posts', 'post'], ['Group chats', 'message']]) {
    await tab(p, name).click();
    await p.waitForURL(new RegExp(`kind=${kind}`));
    await p.waitForSelector(`[data-content-row="${kind}"]`);
    const kinds = await p.locator('[data-content-row]').evaluateAll((r) => [...new Set(r.map((x) => x.getAttribute('data-content-row')))]);
    check(`${name} tab shows only ${kind} items`, kinds.length === 1 && kinds[0] === kind, kinds.join(','));
  }
  check('Private one-to-one messages are not in the group chat list', Number(sql("select count(*) from messages m join conversations c on c.id = m.conversation_id where c.kind = 'direct'")) > 0 && !(await p.locator('body').innerText()).includes(sql("select body from messages m join conversations c on c.id = m.conversation_id where c.kind = 'direct' and m.body <> '' limit 1")));

  await p.goto(BASE + '/admin/content?kind=listing', { waitUntil: 'networkidle' });
  let row = p.locator('[data-content-row=listing]', { hasText: title }).first();
  await row.locator('summary', { hasText: 'Hide…' }).click();
  await row.getByLabel('Reason for hiding').fill('Selling things that are not allowed');
  await row.getByRole('button', { name: 'Hide', exact: true }).click();
  await p.waitForFunction((t) => !document.body.innerText.includes(t), title, { timeout: 15000 }).catch(() => {});
  check('Hiding keeps the listing in the database as removed', sql(`select status from listings where id = '${listing}'`) === 'removed');
  check('The seller is told why', Number(sql(`select count(*) from notifications where recipient_id = '${owner}' and kind = 'removed' and body like '%not allowed%'`)) === 1);
  check('The hiding is in the activity log', Number(sql(`select count(*) from moderation_log where action = 'hide_listing' and target_id = '${listing}'`)) === 1);
  await p.goto(BASE + '/admin/content?kind=listing&view=removed', { waitUntil: 'networkidle' });
  row = p.locator('[data-content-row=listing]', { hasText: title }).first();
  check('It shows under Recently removed with who and why', /Hidden by .* not allowed/.test(await row.innerText()));
  await row.getByRole('button', { name: 'Restore' }).click();
  await p.waitForFunction((t) => !document.body.innerText.includes(t), title, { timeout: 15000 }).catch(() => {});
  check('Restore puts the listing back as it was', ['active', 'reserved', 'sold'].includes(sql(`select status from listings where id = '${listing}'`)));
  // Delete for good needs the listing hidden, a reason and the word DELETE
  await p.goto(BASE + '/admin/content?kind=listing', { waitUntil: 'networkidle' });
  row = p.locator('[data-content-row=listing]', { hasText: title }).first();
  check('A visible listing has no Delete for good button', (await row.locator('summary', { hasText: 'Delete for good…' }).count()) === 0);
  await row.locator('summary', { hasText: 'Hide…' }).click();
  await row.getByLabel('Reason for hiding').fill('Fake listing');
  await row.getByRole('button', { name: 'Hide', exact: true }).click();
  await p.waitForFunction((t) => !document.body.innerText.includes(t), title, { timeout: 15000 }).catch(() => {});
  await p.goto(BASE + '/admin/content?kind=listing&view=removed', { waitUntil: 'networkidle' });
  row = p.locator('[data-content-row=listing]', { hasText: title }).first();
  await row.locator('summary', { hasText: 'Delete for good…' }).click();
  await row.getByLabel('Reason for deleting').fill('Confirmed fake');
  await row.getByLabel('Type DELETE to confirm').fill('delete');
  await row.getByRole('button', { name: 'Delete for good' }).click();
  await p.waitForTimeout(800);
  check('Without typing DELETE nothing is deleted', sql(`select count(*) from listings where id = '${listing}'`) === '1');
  await row.getByLabel('Type DELETE to confirm').fill('DELETE');
  await row.getByRole('button', { name: 'Delete for good' }).click();
  await p.waitForFunction((t) => !document.body.innerText.includes(t), title, { timeout: 15000 }).catch(() => {});
  check('Typing DELETE removes it for good', sql(`select count(*) from listings where id = '${listing}'`) === '0');
  check('A copy of the record is kept in the activity log', Number(sql(`select count(*) from moderation_log where action = 'purge_listing' and details like '%Confirmed fake%copy:%'`)) === 1);

  // Edit and close a poll
  await p.goto(BASE + '/admin/content?kind=club', { waitUntil: 'networkidle' });
  row = p.locator('[data-content-row=club]').first();
  const clubId = sql("select id from clubs order by created_at limit 1");
  const oldName = sql(`select name from clubs where id = '${clubId}'`);
  await p.goto(BASE + '/admin/content?kind=club', { waitUntil: 'networkidle' });
  row = p.locator('[data-content-row=club]', { hasText: oldName }).first();
  await row.locator('summary', { hasText: 'Edit…' }).click();
  await row.getByLabel('Name').fill(oldName + ' (edited)');
  await row.getByRole('button', { name: 'Save changes' }).click();
  await p.waitForTimeout(1200);
  check('Editing a club saves the new name', sql(`select name from clubs where id = '${clubId}'`) === oldName + ' (edited)');
  check('The edit is in the activity log with the old text', Number(sql(`select count(*) from moderation_log where action = 'edit_club' and details like '%${oldName.replace(/'/g, "''")}%'`)) === 1);
  await p.goto(BASE + '/admin/content?kind=poll', { waitUntil: 'networkidle' });
  const open = p.locator('[data-content-row=poll]', { has: p.getByRole('button', { name: 'Close poll' }) }).first();
  if (await open.count()) {
    await open.getByRole('button', { name: 'Close poll' }).click();
    await p.waitForTimeout(1200);
    check('Closing a poll ends it now', Number(sql("select count(*) from moderation_log where action = 'close_poll'")) === 1);
  }

  // Phone layout
  await a.ctx.close();
  const m = await signIn(b, 'demo.rania@pioneers.edu.ps', { width: 390, height: 844 });
  await m.p.goto(BASE + '/admin/content', { waitUntil: 'networkidle' });
  check('No sideways scrolling on a phone', await m.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await b.close();
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
