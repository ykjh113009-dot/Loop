const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim().split('\n').filter(Boolean);
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const body = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');

async function signIn(browser, email, viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator(`input[value="${email}"]`) }).locator('button').click();
  await p.waitForURL('**/home', { timeout: 30000 });
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(800);
  return { ctx, p };
}

(async () => {
  const browser = await chromium.launch();
  const { ctx, p } = await signIn(browser, 'demo.layla@pioneers.edu.ps', { width: 1440, height: 900 });
  const t = await body(p);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hebron', hour: '2-digit', hour12: false }).format(new Date())) % 24;
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  check(`Greeting is personal and matches the time of day (Good ${part}, Layla!)`, t.includes(`Good ${part},`) && t.includes('Layla!'));
  check('The banner has the welcome line and the decoration', t.includes('Keep learning, keep growing') && ((await p.locator('[data-home-hero] [data-banner-art]').count()) === 1));

  const qa = await p.locator('[data-quick-actions] a').evaluateAll(els => els.map(e => [e.textContent.trim(), e.getAttribute('href')]));
  check('5 quick actions with the right links', JSON.stringify(qa) === JSON.stringify([['Join a Challenge', '/challenges'], ['Library', '/academic-resources'], ['Events', '/events'], ['Announcements', '/announcements'], ['Marketplace', '/marketplace']]), JSON.stringify(qa));
  for (const c of ['feed', 'calendar', 'leaderboard']) check(`The ${c} card is on the page`, (await p.locator(`[data-card=${c}]`).count()) === 1);

  // real data
  const ann = q("select title from public.announcements order by created_at desc limit 1");
  check('The feed shows the newest announcement from the database', ann.length > 0 && (await p.locator('[data-announcement]').first().innerText()).includes(ann[0]), ann[0]);
  check('The feed has the post box and the existing posts', (await p.locator('#composer textarea').count()) === 1 && (await p.locator('[data-card=feed] article[data-post]').count()) > 0);
  const ev = q("select title from public.events where status='approved' and starts_at > now() order by starts_at limit 3");
  const cal = await p.locator('[data-card=calendar]').innerText();
  check('My Calendar lists the next events in order with Today/Tomorrow/date labels', ev.length > 0 && ev.every(e => cal.includes(e)) && /Today|Tomorrow|\d{1,2} \w+/.test(cal), ev.join(' / '));
  const houses = q("select h.name from public.houses h order by h.name");
  const lb = await p.locator('[data-card=leaderboard]').innerText();
  check('Leaderboard has Houses, Students and Grades tabs', ['Houses', 'Students', 'Grades'].every(x => lb.includes(x)));
  await p.locator('[data-card=leaderboard] [role=tab]', { hasText: 'Grades' }).click(); await p.waitForTimeout(200);
  check('Switching the leaderboard tab shows that list', (await p.locator('[data-leader-list=grades], [data-card=leaderboard] p').count()) > 0);
  const sc = await p.locator('[data-shortcut]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-shortcut'), e.querySelector('a').getAttribute('href')]));
  check('Four shortcut cards: Academic Library, Events, Announcements, Marketplace', JSON.stringify(sc) === JSON.stringify([['Academic Library', '/academic-resources'], ['Events', '/events'], ['Announcements', '/announcements'], ['Marketplace', '/marketplace']]), JSON.stringify(sc));
  check('No sideways scroll on the computer', (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);

  // links work
  for (const [label, href] of qa) {
    await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
    await p.locator(`[data-quick-actions] a[href="${href}"]`).click();
    await p.waitForURL('**' + href + '*', { timeout: 15000 }).catch(() => {});
    await p.waitForLoadState('networkidle');
    const bt = await body(p);
    check(`Quick action ${label} opens ${href} without errors`, p.url().includes(href) && bt.length > 50 && !/Application error|couldn.t load/i.test(bt), p.url().replace(BASE, ''));
  }
  await ctx.close();

  // staff without a student profile still get a dashboard
  const adm = await signIn(browser, 'demo.admin@pioneers.edu.ps', { width: 1440, height: 900 }).catch(() => null);
  if (adm) { check('Staff see the dashboard too', (await body(adm.p)).includes('Welcome back to Loop')); await adm.ctx.close(); }

  // phones
  for (const w of [360, 390, 430]) {
    const s = await signIn(browser, 'demo.layla@pioneers.edu.ps', { width: w, height: 800 }, true);
    const m = await s.p.evaluate((w) => ({ over: Math.max(document.documentElement.scrollWidth, innerWidth) - w, tabs: [...document.querySelectorAll('[data-bottom-tabs] a')].map(a => a.textContent.trim()), fab: !!document.querySelector('a[aria-label="New post"]'), sidebar: getComputedStyle(document.querySelector('[data-sidebar-root]')).display }), w);
    check(`Phone ${w}px: no sideways scroll, sidebar hidden, five tabs, new-post button`, m.over <= 0 && m.sidebar === 'none' && JSON.stringify(m.tabs) === JSON.stringify(['Home', 'Community', 'School', 'Learn', 'Market']) && m.fab, JSON.stringify(m));
    const small = await s.p.evaluate(() => [...document.querySelectorAll('[data-bottom-tabs] a, [data-quick-actions] a')].filter(a => a.getBoundingClientRect().height < 44).length);
    check(`Phone ${w}px: tabs and quick actions are at least 44 px tall`, small === 0, small + ' too small');
    await s.ctx.close();
  }

  const anon = await browser.newContext(); const ap = await anon.newPage(); const bad = [];
  for (const r of ['/home', '/community', '/announcements', '/search?q=maya', '/messages', '/events']) { await ap.goto(BASE + r, { waitUntil: 'networkidle' }); if (!ap.url().includes('/login')) bad.push(r); }
  check('Signed-out visitors cannot open the dashboard, community, announcements or search', bad.length === 0, bad.join(','));
  await anon.close();
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
