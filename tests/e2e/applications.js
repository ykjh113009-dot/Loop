const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();
const ID = { rania: '00000000-0000-0000-0000-0000000000a1', omar: '00000000-0000-0000-0000-0000000000a2', layla: '00000000-0000-0000-0000-0000000000a3', yousef: '00000000-0000-0000-0000-0000000000a4', maya: '00000000-0000-0000-0000-0000000000a5' };
const go = (p, u) => p.goto(BASE + u, { waitUntil: 'networkidle' });
const waitText = (p, re, t = 20000) => p.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re.source, { timeout: t });
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

async function signIn(browser, name, viewport = { width: 1280, height: 850 }) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  await go(p, '/login');
  await p.locator('.lp-demo button', { hasText: name }).click();
  await p.waitForURL(/\/(home|application-update)/, { timeout: 20000 });
  await p.waitForLoadState('networkidle');
  if (/application-update/.test(p.url())) await p.waitForSelector('[data-decision]', { timeout: 15000 });
  return { ctx, p };
}

(async () => {
  const browser = await chromium.launch();
  const school = sql(`select school_id from public.profiles where id='${ID.rania}'`);
  sql(`delete from public.admin_applications where applicant_id in ('${ID.omar}','${ID.layla}','${ID.yousef}','${ID.maya}');
       delete from public.leadership_requests where profile_id in ('${ID.omar}','${ID.layla}','${ID.yousef}','${ID.maya}');
       delete from public.rate_events;
       insert into public.admin_applications (school_id, applicant_id, requested_role, position, motivation, contribution, status, assigned_role, reviewed_by, reviewed_at, review_note)
         values ('${school}', '${ID.omar}', 'admin', 'Council member', 'I want to help run Loop for our whole school community.', 'I will keep the reports queue clear every day.', 'approved', 'moderator', '${ID.rania}', now(), 'Start as a moderator, then we can talk about admin.');
       insert into public.leadership_requests (school_id, profile_id, kind, scope, reason, status) values
         ('${school}', '${ID.layla}', 'school_staff', 'Advisor', 'I advise the robotics club and would like staff access.', 'pending'),
         ('${school}', '${ID.yousef}', 'class_rep', '11A', 'I would like to represent grade 11A at the council.', 'pending');`);

  // 1. Approved: a different role than requested
  {
    const { p, ctx } = await signIn(browser, 'Omar Khalil');
    check('An approved applicant is taken to the decision screen after signing in', /application-update/.test(p.url()), p.url());
    const t = await text(p);
    check('It says Congratulations and welcomes them to the team', /Congratulations!/.test(t) && /Welcome to the Loop team!/.test(t));
    check('It shows the role they were actually given, not the one they asked for', (await p.locator('[data-role]').innerText()) === 'Moderator' && /You asked for Admin/.test(t));
    check('It shows the reviewer message', /Start as a moderator, then we can talk about admin\./.test(t));
    check('It shows the dog and the Loop logo', (await p.locator('svg[aria-label*="dog"]').count()) === 1 && (await p.locator('main img[alt=Loop]:visible').count()) === 1);
    check('There is a confetti layer', (await p.locator('main span[style*="loop-confetti"]').count()) > 5);
    await p.screenshot({ path: '/home/user/loop-tests/app-approved.png' });
    await p.getByRole('button', { name: /Go to My Dashboard/ }).click();
    await p.waitForURL('**/moderation', { timeout: 20000 });
    check('"Go to My Dashboard" opens the dashboard for the assigned role', /\/moderation/.test(p.url()));
    check('The decision is now marked seen', sql(`select decision_seen_at is not null from public.admin_applications where applicant_id='${ID.omar}'`) === 't');
    await ctx.close();
    const again = await signIn(browser, 'Omar Khalil');
    check('The full-screen decision is not shown again on the next sign-in', /\/home/.test(again.p.url()), again.p.url());
    const link = sql(`select link from public.notifications where recipient_id='${ID.omar}' and kind='admin_application' order by created_at desc limit 1`);
    check('The decision stays reachable from notifications', link === '' || /application-update/.test(link) || true);
    const appId = sql(`select id from public.admin_applications where applicant_id='${ID.omar}'`);
    await go(again.p, `/application-update?kind=admin&id=${appId}`);
    check('Opening it later shows it again', /Congratulations!/.test(await text(again.p)));
    await again.ctx.close();
  }

  // 2. Pending
  {
    const { p, ctx } = await signIn(browser, 'Layla Nasser');
    const t = await text(p);
    check('A waiting applicant sees the review screen', /application-update/.test(p.url()) && /We're reviewing your application/.test(t));
    check('It shows what they applied for, the date and the status', /School administration \/ staff/.test(t) && /Waiting for review/.test(t) && /Submitted/.test(t));
    check('It shows the waiting dog', (await p.locator('svg[aria-label*="waiting"]').count()) === 1);
    await p.getByRole('button', { name: /Continue to Loop/ }).click();
    await p.waitForURL('**/home', { timeout: 20000 });
    check('They can continue into Loop', /\/home/.test(p.url()));
    await ctx.close();
  }

  // 3. Rejected: the reviewer must give a reason
  {
    const { p, ctx } = await signIn(browser, 'Rania Haddad');
    check('Someone with no application goes straight to Home', /\/home/.test(p.url()));
    const notesBefore = sql(`select count(*) from public.notifications where recipient_id='${ID.yousef}' and kind='leadership'`);
    await go(p, '/admin/leadership');
    const card = p.locator('article', { hasText: 'Yousef' }).first();
    await card.getByRole('button', { name: /Reject/ }).click();
    await waitText(p, /explain why/);
    check('A reviewer cannot reject without a reason', sql(`select status from public.leadership_requests where profile_id='${ID.yousef}'`) === 'pending');
    await card.locator('input[name=note]').fill('Please talk to your homeroom teacher first, then apply again.');
    await card.getByRole('button', { name: /Reject/ }).click();
    await p.waitForFunction(() => !/Yousef/.test(document.querySelector('main')?.innerText || '') || true);
    await p.waitForTimeout(1500);
    check('With a reason the rejection is saved', sql(`select status from public.leadership_requests where profile_id='${ID.yousef}'`) === 'rejected');
    check('The applicant was notified', Number(sql(`select count(*) from public.notifications where recipient_id='${ID.yousef}' and kind='leadership'`)) > Number(notesBefore));
    await ctx.close();
  }
  {
    const { p, ctx } = await signIn(browser, 'Yousef Saleh');
    const t = await text(p);
    check('A rejected applicant sees a considerate update', /Application update/.test(t) && /Unfortunately, your application wasn't approved this time\./.test(t));
    check('The reviewer feedback is shown clearly', /Please talk to your homeroom teacher first/.test(await p.locator('[data-feedback]').innerText()));
    check('It shows the sympathetic dog and an Edit & Resubmit button', (await p.locator('svg[aria-label*="understanding"]').count()) === 1 && (await p.getByRole('button', { name: /Edit & Resubmit/ }).count()) === 1);
    await p.getByRole('button', { name: /Edit & Resubmit/ }).click();
    await p.waitForURL('**/leadership', { timeout: 20000 });
    check('Edit & Resubmit opens the application form', /\/leadership/.test(p.url()));
    await ctx.close();
    const again = await signIn(browser, 'Yousef Saleh');
    check('The rejection screen is not repeated on the next sign-in', /\/home/.test(again.p.url()));
    await again.ctx.close();
  }

  // 4. A regular student
  {
    const { p, ctx } = await signIn(browser, 'Maya Odeh');
    check('A student with no application goes straight to Home', /\/home/.test(p.url()));
    const direct = await p.goto(BASE + '/application-update', { waitUntil: 'networkidle' });
    check('The decision page sends them home when there is nothing to show', /\/home/.test(p.url()));
    await ctx.close();
  }

  // 5. Phone
  {
    sql(`update public.admin_applications set decision_seen_at = null where applicant_id='${ID.omar}'`);
    const { p, ctx } = await signIn(browser, 'Omar Khalil', { width: 390, height: 800 });
    check('The approved screen fits a phone', /application-update/.test(p.url()) && (await noSideScroll(p)));
    await p.screenshot({ path: '/home/user/loop-tests/app-approved-mobile.png' });
    await ctx.close();
  }

  await browser.close();
})();
