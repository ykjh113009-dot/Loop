const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '/home/user/loop-tests/';
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const go = (p, u) => p.goto(BASE + u, { waitUntil: 'networkidle' });
const waitText = (p, re, t = 20000) => p.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re.source, { timeout: t });
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const MAYA = '00000000-0000-0000-0000-0000000000a5';
async function signIn(b, name, vp = { width: 1280, height: 900 }) { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); await go(p, '/login'); await p.locator('.lp-demo button', { hasText: name }).click(); await p.waitForURL('**/home'); await p.waitForLoadState('networkidle'); return { ctx, p }; }
(async () => {
  const b = await chromium.launch();
  sql(`delete from public.points_ledger where profile_id='${MAYA}'; delete from public.profile_badges where profile_id='${MAYA}'; delete from public.login_days where profile_id='${MAYA}'; delete from public.student_stats where profile_id='${MAYA}'; delete from public.streak_milestones where profile_id='${MAYA}'; delete from public.rate_events;`);

  // 1. Daily login: once, with a small live message
  let m = await signIn(b, 'Maya Odeh');
  await m.p.waitForSelector('[data-reward-toast]', { timeout: 15000 }).catch(() => {});
  check('Signing in shows a small "+5 Loop Points" message', /\+5 Loop Points/.test(await text(m.p)));
  check('The daily login reward is in the ledger once', sql(`select count(*) from public.points_ledger where profile_id='${MAYA}' and reason='daily_login'`) === '1');
  await go(m.p, '/home'); await m.p.waitForTimeout(1500);
  await m.ctx.close();
  m = await signIn(b, 'Maya Odeh');
  await m.p.waitForTimeout(2500);
  check('Signing in again the same day pays nothing more', sql(`select count(*) from public.points_ledger where profile_id='${MAYA}' and reason='daily_login'`) === '1');
  check('The first day unlocks "First Day"', sql(`select count(*) from public.profile_badges where profile_id='${MAYA}' and badge_code='first_day'`) === '1');

  // 2. My points
  const p = m.p;
  await go(p, '/points');
  await p.waitForSelector('[data-streak]');
  let t = await text(p);
  check('My points shows the level name, streak and balance', (await p.locator('[data-testid=level-name]').count()) === 1 && (await p.locator('[data-testid=streak-current]').count()) === 1 && (await p.locator('[data-testid=balance]').count()) === 1);
  check('Achievements show unlocked and locked ones with progress', (await p.locator('[data-achievement][data-unlocked=true]').count()) >= 1 && (await p.locator('[data-achievement][data-unlocked=false]').count()) >= 5 && /\d+\/\d+/.test(t));
  check('The history says what was earned and why', /Daily login/.test(t) && (await p.locator('[data-history] li').count()) >= 1);
  await p.screenshot({ path: SHOTS + 'rw-1-points.png', fullPage: true });
  await p.locator('[data-achievement=first_day] button[aria-pressed]').click();
  await p.waitForTimeout(1200);
  check('A student can choose a badge to show on their profile', sql(`select pinned from public.profile_badges where profile_id='${MAYA}' and badge_code='first_day'`) === 't');
  const y = await signIn(b, 'Yousef Saleh');
  await go(y.p, `/profile/${MAYA}`);
  t = await text(y.p);
  check('Others see the chosen badge and the level name, not the points', /First Day/.test(t) && !/Loop Points/.test(t) && /Newcomer|Explorer/.test(t));
  await y.ctx.close();

  // 3. Admin: statistics, lookup, adjust, reverse
  const r = await signIn(b, 'Rania Haddad');
  await go(r.p, '/admin/points');
  await r.p.waitForSelector('[data-reward-tools]');
  check('Admins see reward statistics and the unusual-activity list', (await r.p.locator('[data-stats]').count()) === 1 && (await r.p.locator('[data-suspicious]').count()) === 1);
  await r.p.fill('[data-lookup] input[name=q]', 'Maya');
  await r.p.locator('[data-lookup]').getByRole('button', { name: 'Search' }).click();
  await r.p.waitForURL('**/admin/points?q=Maya');
  await r.p.locator('a[href^="/admin/points?profile="]', { hasText: 'Maya Odeh' }).first().click();
  await r.p.waitForSelector('[data-student]');
  const before = Number(await r.p.locator('[data-testid=adm-balance]').innerText());
  await r.p.fill('[data-student] input[name=points]', '40');
  await r.p.fill('[data-student] input[name=reason]', 'Won the school quiz');
  await r.p.getByRole('button', { name: 'Save adjustment' }).click();
  await r.p.waitForFunction(() => true); for (let i = 0; i < 30 && sql(`select count(*) from public.points_ledger where profile_id='${MAYA}' and kind='adjust'`) === '0'; i++) await r.p.waitForTimeout(300);
  await r.p.reload({ waitUntil: 'networkidle' });
  check('A manual award changes the balance and is recorded with its reason', Number(await r.p.locator('[data-testid=adm-balance]').innerText()) === before + 40 && /Won the school quiz/.test(await text(r.p)));
  await r.p.locator('[data-ledger] li', { hasText: 'Won the school quiz' }).locator('summary').click();
  await r.p.locator('[data-ledger] li', { hasText: 'Won the school quiz' }).locator('input[name=reason]').fill('Entered by mistake');
  await r.p.locator('[data-ledger] li', { hasText: 'Won the school quiz' }).getByRole('button', { name: 'Reverse' }).click();
  for (let i = 0; i < 30 && sql(`select count(*) from public.points_ledger where profile_id='${MAYA}' and kind='reversal'`) === '0'; i++) await r.p.waitForTimeout(300);
  await r.p.reload({ waitUntil: 'networkidle' });
  check('A reversal keeps the original entry and adds a correction', Number(await r.p.locator('[data-testid=adm-balance]').innerText()) === before && (await r.p.locator('[data-ledger] li', { hasText: 'Won the school quiz' }).count()) >= 1 && /reversed/.test(await text(r.p)));
  await r.p.screenshot({ path: SHOTS + 'rw-2-admin.png', fullPage: true });
  await r.ctx.close();

  // 4. Students cannot reach the tools
  await go(p, '/admin/points');
  check('A student cannot use the reward tools', /Only admins and school staff/.test(await text(p)) && (await p.locator('[data-reward-tools]').count()) === 0);
  await go(p, '/points');
  check('The student sees the correction in their history', /Adjusted by an admin/.test(await text(p)) && /Correction/.test(await text(p)));

  // 5. Phone
  await m.ctx.close();
  const ph = await signIn(b, 'Maya Odeh', { width: 390, height: 844 });
  await go(ph.p, '/points'); await ph.p.waitForSelector('[data-streak]');
  check('My points fits a phone', await noSideScroll(ph.p));
  await ph.p.screenshot({ path: SHOTS + 'rw-3-points-phone.png', fullPage: true });
  await b.close();
})();
