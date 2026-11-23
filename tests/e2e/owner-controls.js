const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = (q) => execSync(`psql ${DB} -qtAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
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
const manage = (p, kind) => p.locator(`[data-admin-controls="${kind}"]`).first();
const open = async (p, kind) => { await manage(p, kind).locator('summary').click(); return manage(p, kind); };
(async () => {
  // Rania plays the platform owner in this test: her address is added to the owner list.
  sql("insert into platform_owners (email) values ('demo.rania@pioneers.edu.ps') on conflict do nothing");
  const b = await chromium.launch();

  // A student never sees the controls.
  const s = await signIn(b, 'demo.layla@pioneers.edu.ps');
  for (const u of ['/announcements', '/polls', '/market', '/home']) { await s.p.goto(BASE + u, { waitUntil: 'networkidle' }); if ((await s.p.locator('[data-admin-controls]').count()) > 0) check('A student sees no Manage button on ' + u, false); }
  check('A student sees no Manage buttons anywhere', true);
  await s.ctx.close();

  // A moderator can manage posts, not clubs.
  const mo = await signIn(b, 'demo.omar@pioneers.edu.ps');
  await mo.p.goto(BASE + '/home', { waitUntil: 'networkidle' });
  check('A moderator sees Manage on posts', (await mo.p.locator('[data-admin-controls="post"]').count()) > 0);
  const club = sql("select id from clubs where status = 'approved' order by created_at limit 1");
  await mo.p.goto(BASE + '/clubs/' + club, { waitUntil: 'networkidle' });
  check('A moderator does not see Manage on a club', (await mo.p.locator('[data-admin-controls="club"]').count()) === 0);
  await mo.ctx.close();

  const a = await signIn(b, 'demo.rania@pioneers.edu.ps');
  const p = a.p;

  // Marketplace: hide a listing from its own page.
  const listing = sql("select id from listings where status = 'active' order by created_at limit 1");
  const lt = sql(`select title from listings where id = '${listing}'`);
  await p.goto(BASE + '/market/' + listing, { waitUntil: 'networkidle' });
  let box = await open(p, 'listing');
  check('The platform owner sees Edit, Hide and Delete on a listing', (await box.getByRole('button', { name: /Save changes|^Hide$|Delete for good/ }).count()) === 3);
  await box.getByLabel('Reason for hiding').fill('Not allowed on Loop');
  await box.getByRole('button', { name: 'Hide', exact: true }).click();
  await p.waitForURL(/\/market(\?|$)/, { timeout: 15000 });
  check('Hiding a listing from its page removes it and returns to the Marketplace', sql(`select status from listings where id = '${listing}'`) === 'removed' && !(await p.locator('body').innerText()).includes(lt));
  check('It is recorded and can be restored from Recently removed', Number(sql(`select count(*) from admin_hidden where kind = 'listing' and id = '${listing}'`)) === 1);

  // Library: hide a resource.
  sql("insert into library_resources (school_id, source, subject_id, title, type, link_url, published_at, visibility) select s.school_id, 'official', s.id, 'Owner test notes', 'pdf_notes', 'https://example.com/notes', now(), 'visible' from study_categories s limit 1");
  const res = sql("select id from library_resources where title = 'Owner test notes'");
  await p.goto(BASE + '/academic-resources/resource/' + res, { waitUntil: 'networkidle' });
  box = await open(p, 'resource');
  await box.getByLabel('Reason for hiding').fill('Wrong subject');
  await box.getByRole('button', { name: 'Hide', exact: true }).click();
  await p.waitForURL(/\/academic-resources(\?|$)/, { timeout: 15000 });
  check('Hiding a Library resource from its page works', sql(`select visibility from library_resources where id = '${res}'`) === 'removed');

  // Community: edit a post, hide a comment, close a poll.
  const post = sql("select id from posts where status = 'visible' and kind not in ('poll','announcement') order by created_at limit 1");
  await p.goto(BASE + '/post/' + post, { waitUntil: 'networkidle' });
  box = await open(p, 'post');
  await box.getByLabel('Text').fill('Edited by the platform owner');
  await box.getByRole('button', { name: 'Save changes' }).click();
  await p.waitForFunction(() => document.body.innerText.includes('Edited by the platform owner'), null, { timeout: 15000 }).catch(() => {});
  check('Editing a post from its page saves the new text', sql(`select body from posts where id = '${post}'`) === 'Edited by the platform owner');
  await p.goto(BASE + '/polls', { waitUntil: 'networkidle' });
  const pollCard = p.locator('article', { has: p.locator('[data-admin-controls="poll"]') }).filter({ hasText: /closes/ }).first();
  const openBefore = Number(sql("select count(*) from polls where closes_at > now()"));
  if (await pollCard.count()) {
    await pollCard.locator('[data-admin-controls="poll"] summary').click();
    await pollCard.getByRole('button', { name: 'Close this poll now' }).click();
    await p.waitForTimeout(1500);
    check('Closing a poll from the Polls page ends it', Number(sql('select count(*) from polls where closes_at > now()')) === openBefore - 1);
  }

  // Groups and clubs: edit.
  sql("insert into groups (school_id, name, created_by) select school_id, 'Owner test group', id from profiles where full_name = 'Layla Nasser'");
  const grp = sql("select id from groups where name = 'Owner test group'");
  await p.goto(BASE + '/groups/' + grp, { waitUntil: 'networkidle' });
  box = await open(p, 'group');
  await box.getByLabel('Name').fill('Owner test group (edited)');
  await box.getByRole('button', { name: 'Save changes' }).click();
  await p.waitForTimeout(1500);
  check('Editing a group from its page saves the name', sql(`select name from groups where id = '${grp}'`) === 'Owner test group (edited)');
  await p.goto(BASE + '/clubs/' + club, { waitUntil: 'networkidle' });
  check('The platform owner sees Manage on a club', (await p.locator('[data-admin-controls="club"]').count()) > 0);

  // School Life: events, challenges, announcements, council, volunteering.
  const ev = sql("select id from events where status = 'approved' order by starts_at limit 1");
  await p.goto(BASE + '/events/' + ev, { waitUntil: 'networkidle' });
  check('Manage shows on an event', (await p.locator('[data-admin-controls="event"]').count()) > 0);
  const ch = sql("select id from challenges where status = 'approved' order by created_at limit 1");
  await p.goto(BASE + '/challenges/' + ch, { waitUntil: 'networkidle' });
  check('Manage shows on a challenge', (await p.locator('[data-admin-controls="challenge"]').count()) > 0);
  const ann = sql("select id from announcements order by created_at limit 1");
  const annTitle = sql(`select title from announcements where id = '${ann}'`);
  await p.goto(BASE + '/announcements', { waitUntil: 'networkidle' });
  const annRow = p.locator('li', { hasText: annTitle }).first();
  await annRow.locator('[data-admin-controls] summary').click();
  await annRow.getByLabel('Title').fill('Announcement edited by the owner');
  await annRow.getByRole('button', { name: 'Save changes' }).click();
  await p.waitForTimeout(1500);
  check('Editing an announcement in place saves it', sql(`select title from announcements where id = '${ann}'`) === 'Announcement edited by the owner');
  const row2 = p.locator('li', { hasText: 'Announcement edited by the owner' }).first();
  if (!(await row2.locator('[data-admin-controls]').evaluate((d) => d.open))) await row2.locator('[data-admin-controls] summary').click();
  await row2.getByLabel('Reason for deleting').fill('Out of date');
  await row2.getByLabel('Type DELETE to confirm').fill('DELETE');
  await row2.getByRole('button', { name: 'Delete for good' }).click();
  await p.waitForTimeout(1500);
  check('Deleting an announcement for good needs DELETE and works', sql(`select count(*) from announcements where id = '${ann}'`) === '0');
  check('The deletion is in the activity log with a copy', Number(sql("select count(*) from moderation_log where action = 'purge_announcement' and details like '%copy:%'")) === 1);

  // Phone layout of a controlled page.
  await a.ctx.close();
  const m = await signIn(b, 'demo.rania@pioneers.edu.ps', { width: 390, height: 844 });
  await m.p.goto(BASE + '/polls', { waitUntil: 'networkidle' });
  check('No sideways scrolling on a phone', await m.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await b.close();
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
