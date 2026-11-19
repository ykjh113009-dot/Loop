const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3000';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };

(async () => {
  const b = await chromium.launch();
  for (const [label, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage();
    await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await p.locator('form', { has: p.locator('input[value="demo.layla@pioneers.edu.ps"]') }).locator('button').click();
    await p.waitForURL('**/home'); await p.waitForTimeout(600);
    await p.goto(BASE + '/school-life', { waitUntil: 'networkidle' });
    check(`${label}: banner says School Life with the tagline`, /School Life/.test(await p.locator('[data-banner-title]').innerText()) && /Be part of your school\./.test(await p.locator('[data-category-page]').innerText()));
    const now = new Date();
    const monthName = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hebron', month: 'long', year: 'numeric' }).format(now);
    check(`${label}: the calendar shows this month and marks today`, (await p.locator('[data-calendar-month]').innerText()).trim() === monthName && (await p.locator('[data-today=true]').count()) === 1);
    check(`${label}: days with events have a dot`, (await p.locator('[data-card=calendar] [data-busy]').count()) >= 1);
    await p.locator('[data-card=calendar] a[aria-label="Next month"]').click(); await p.waitForURL('**month=**');
    check(`${label}: the next-month arrow opens the next month`, (await p.locator('[data-calendar-month]').innerText()).trim() !== monthName);
    await p.locator('[data-card=calendar] a[aria-label="Previous month"]').click(); await p.waitForURL('**month=**');
    const ev = await p.locator('[data-card=events] li').count();
    await p.goto(BASE + '/school-life?month=2020-02', { waitUntil: 'networkidle' });
    check(`${label}: an old month works (February 2020 has 29 days)`, (await p.locator('[data-card=calendar] [data-day]').count()) === 29);
    await p.goto(BASE + '/school-life?month=nonsense', { waitUntil: 'networkidle' });
    check(`${label}: a bad month in the address falls back to this month`, (await p.locator('[data-calendar-month]').innerText()).trim() === monthName);
    check(`${label}: Upcoming Events lists the next events with date, time and place`, ev >= 1 && /\d{1,2}:\d{2}/.test(await p.locator('[data-card=events]').innerText()));
    const tiles = await p.locator('[data-tile]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-tile'), e.getAttribute('href')]));
    check(`${label}: eight tiles with the right links`, JSON.stringify(tiles) === JSON.stringify([['Calendar & Events', '/events'], ['Activities & Challenges', '/challenges'], ['Houses', '/houses'], ['Leaderboards', '/leaderboard'], ['Student Council', '/council'], ['Volunteering', '/volunteering'], ['Loop Passport', '/passport'], ['Campus Map', '/campus']]), JSON.stringify(tiles));
    check(`${label}: Campus Map is marked Soon`, /Soon/.test(await p.locator('[data-tile="Campus Map"]').innerText()));
    const bad = [];
    for (const [, to] of tiles) { const r = await p.goto(BASE + to, { waitUntil: 'domcontentloaded' }); if (!r || r.status() >= 400) bad.push(to); }
    check(`${label}: every tile opens a real page`, bad.length === 0, bad.join(','));
    await p.goto(BASE + '/school-life', { waitUntil: 'networkidle' });
    check(`${label}: School Life fits the screen`, (await p.evaluate((w) => Math.max(document.documentElement.scrollWidth, innerWidth) - w, vp.width)) <= 0);
    await ctx.close();
  }
  await b.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
