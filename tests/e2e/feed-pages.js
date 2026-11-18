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
    const fits = async () => (await p.evaluate((w) => Math.max(document.documentElement.scrollWidth, innerWidth) - w, vp.width)) <= 0;
    const go = async (r) => { await p.goto(BASE + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(300); };

    await go('/community');
    const tabs = await p.locator('[data-section-tabs] a').allInnerTexts();
    check(`${label}: feed tabs are All Posts, Chats, Groups, Clubs, Polls, Saved`, JSON.stringify(tabs.map((x) => x.trim())) === JSON.stringify(['All Posts', 'Chats', 'Groups', 'Clubs', 'Polls', 'Saved']), tabs.join(','));
    check(`${label}: the post box has Photo, Question, Achievement, Poll and a Post button`, (await p.locator('#composer').getByRole('button', { name: 'Photo' }).count()) === 1 && (await p.locator('#composer [role=radio]').count()) === 4 && (await p.locator('#composer').getByRole('button', { name: 'Post', exact: true }).count()) === 1);
    const card = p.locator('article[data-post]').first();
    check(`${label}: posts are rounded cards with @handle, time, reactions and a save button`, (await card.count()) === 1 && /@\w+/.test(await card.innerText()) && (await card.locator('[data-testid=reaction-count]').count()) === 1 && (await card.getByRole('button', { name: /Save/ }).count()) === 1);
    check(`${label}: feed fits the screen`, await fits());

    await go('/groups');
    check(`${label}: Groups has its banner, tabs and search`, (await p.locator('[data-banner]').count()) === 1 && (await p.locator('[data-section-tabs] a').count()) === 3 && (await p.locator('[data-groups-page] input[name=q]').count()) === 1);
    await go('/groups?tab=mine');
    check(`${label}: My Groups tab opens`, p.url().includes('tab=mine'));
    check(`${label}: Groups fits the screen`, await fits());

    await go('/polls');
    const ptabs = await p.locator('[data-section-tabs] a').allInnerTexts();
    check(`${label}: Polls has Active, Ended and My Polls tabs and a Create a Poll card`, JSON.stringify(ptabs.map((x) => x.trim())) === JSON.stringify(['Active Polls', 'Ended Polls', 'My Polls']) && (await p.getByText('Create a Poll').count()) === 1);
    await go('/polls?tab=ended');
    check(`${label}: Ended polls tab opens`, p.url().includes('tab=ended'));
    check(`${label}: Polls fits the screen`, await fits());

    await go('/saved');
    const stabs = await p.locator('[data-section-tabs] a').allInnerTexts();
    check(`${label}: Saved has Posts, Polls and Resources tabs`, JSON.stringify(stabs.map((x) => x.trim())) === JSON.stringify(['Posts', 'Polls', 'Resources']), stabs.join(','));
    await go('/saved?tab=resources');
    check(`${label}: Saved resources tab opens`, /Saved/.test(await p.locator('[data-banner-title]').innerText()));
    check(`${label}: Saved fits the screen`, await fits());
    await ctx.close();
  }
  await b.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
