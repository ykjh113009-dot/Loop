const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const go = (p, u) => p.goto(BASE + u, { waitUntil: 'networkidle' });
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
async function signIn(b, name, vp) { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); await go(p, '/login'); await p.locator('.lp-demo button', { hasText: name }).click(); await p.waitForURL('**/home'); await p.waitForLoadState('networkidle'); return { ctx, p }; }
(async () => {
  const b = await chromium.launch();
  const club = sql(`select c.id from public.clubs c where c.status='approved' order by name limit 1`);
  sql(`insert into public.events (school_id, title, description, location, starts_at, ends_at, club_id, status, created_by)
       select c.school_id, 'E2E club meeting', 'Weekly meeting', 'Room 12', now() + interval '3 days', now() + interval '3 days 1 hour', c.id, 'approved', (select profile_id from public.club_members where club_id=c.id and role='leader' limit 1) from public.clubs c where c.id='${club}'
       and not exists (select 1 from public.events where title='E2E club meeting')`);
  const maya = await signIn(b, 'Maya Odeh', { width: 1280, height: 900 });
  const p = maya.p;
  await p.waitForSelector('aside a[href="/counselor"]', { timeout: 15000 });
  const labels = await p.locator('aside nav[aria-label=Main] a').allInnerTexts();
  check('The sidebar scrolls inside itself (nothing cut off)', (await p.locator('aside nav[aria-label=Main]').evaluate((n) => getComputedStyle(n).overflowY)) === 'auto');
  check('Clubs, Polls, Marketplace and the counselor are in the sidebar', ['Clubs', 'Polls', 'Buy, sell & swap', 'Talk to the counselor'].every((x) => labels.some((l) => l.trim().startsWith(x))));
  check('The profile menu no longer has More features', (await p.locator('header button[aria-label="Profile menu"]').first().click().then(() => p.waitForTimeout(300)).then(async () => !/More features/.test(await text(p)))));
  await go(p, '/clubs');
  check('The club list shows who runs each club', (await p.locator('[data-club-leaders]').count()) >= 1 && /Run by/.test(await text(p)));
  check('The club list shows the next meeting date', (await p.locator('[data-club-next]').count()) >= 1);
  await go(p, `/clubs/${club}`);
  check('The club page shows who runs it (with links)', (await p.locator('[data-club-runners] a').count()) >= 1);
  check('The club page shows the next meeting', (await p.locator('[data-club-next]').count()) === 1 && /E2E club meeting/.test(await text(p)));
  check('Club chat and members are one tap away', /Chat/.test(await text(p)) && /Members/.test(await text(p)));
  await go(p, '/clubs/new');
  check('Students can request a club', (await p.locator('form').count()) >= 1);
  // phone: the More tab shows the same list
  const ph = await signIn(b, 'Maya Odeh', { width: 390, height: 844 });
  await go(ph.p, '/more');
  const items = await ph.p.locator('main [data-nav-group] a').allInnerTexts();
  check('The phone menu lists everything the sidebar does', items.length === 22 && items.some((i) => /Clubs/.test(i)) && items.some((i) => /Tawjihi/.test(i)), String(items.length));
  check('The phone menu fits the screen', await noSideScroll(ph.p));
  await ph.p.screenshot({ path: '/home/user/loop-tests/more-mobile.png', fullPage: true });
  await b.close();
})();
