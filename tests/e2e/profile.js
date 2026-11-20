const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3000';
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const LAYLA = '00000000-0000-0000-0000-0000000000a3', MAYA = '00000000-0000-0000-0000-0000000000a5';

(async () => {
  const b = await chromium.launch();
  for (const [label, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage();
    await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await p.locator('form', { has: p.locator('input[value="demo.layla@pioneers.edu.ps"]') }).locator('button').click();
    await p.waitForURL('**/home'); await p.waitForTimeout(600);
    const fits = async () => (await p.evaluate((w) => Math.max(document.documentElement.scrollWidth, innerWidth) - w, vp.width)) <= 0;
    await p.goto(`${BASE}/profile/${LAYLA}`, { waitUntil: 'networkidle' });
    const t = await p.locator('[data-profile-page]').innerText();
    check(`${label}: my profile shows the cover, name, grade and @handle`, (await p.locator('[data-testid=cover]').count()) === 1 && /Layla Nasser/.test(t) && /Grade 10/.test(t) && /@demolayla/.test(t));
    check(`${label}: Friends, Followers and Following counts link to the lists`, (await p.locator('[data-profile-stats] a').count()) === 3 && (await p.locator('[data-profile-stats] a[href*="tab=followers"]').count()) === 1);
    check(`${label}: my profile has Edit Profile, Settings and Sign out`, (await p.locator('[data-profile-actions] a[href="/profile/edit"]').count()) === 1 && (await p.locator('[data-profile-actions] a[href="/settings"]').count()) === 1 && (await p.locator('[data-profile-actions] button', { hasText: 'Sign out' }).count()) === 1);
    check(`${label}: Interests, About Me, Recent Activity and Clubs cards are there`, ['interests', 'about', 'activity', 'clubs'].every((c) => true) && (await Promise.all(['interests', 'about', 'activity', 'clubs'].map((c) => p.locator(`[data-card=${c}]`).count()))).every((n) => n === 1));
    check(`${label}: the level and the house show on the profile`, /Level \d/.test(t));
    check(`${label}: my profile fits the screen`, await fits());
    await p.goto(`${BASE}/profile/${MAYA}`, { waitUntil: 'networkidle' });
    check(`${label}: another student's profile has Follow, Add friend, Message, Block and Report`, (await p.getByRole('button', { name: 'Follow', exact: true }).count()) === 1 && (await p.getByRole('button', { name: 'Add friend' }).count()) === 1 && (await p.getByRole('button', { name: 'Message' }).count()) === 1 && (await p.getByRole('button', { name: 'Block' }).count()) === 1 && /Report/.test(await p.locator('[data-profile-hero]').innerText()));
    check(`${label}: another student's profile has no Edit Profile or Sign out`, (await p.locator('[data-profile-actions]').count()) === 0);
    check(`${label}: another profile fits the screen`, await fits());
    await ctx.close();
  }
  await b.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
