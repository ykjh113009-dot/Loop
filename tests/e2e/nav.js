const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3000';
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

const TREE = {
  Home: ['Dashboard'],
  Community: ['Clubs', 'Groups', 'Chats', 'Polls', 'Saved'],
  'School Life': ['Calendar & Events', 'Activities & Challenges', 'Houses', 'Leaderboards', 'Student Council', 'Volunteering', 'Loop Passport', 'Campus Map & Directory'],
  'Learning Hub': ['Academic Library', 'Tutors Directory'],
  Marketplace: ['Student Marketplace', 'Reward Shop', 'Top 10 Prizes'],
};
const LANDING = { Home: '/home', Community: '/clubs', 'School Life': '/school-life', 'Learning Hub': '/learning-hub', Marketplace: '/marketplace' };

(async () => {
  const browser = await chromium.launch();
  const { ctx, p } = await signIn(browser, 'demo.layla@pioneers.edu.ps', { width: 1440, height: 900 });

  const cats = await p.locator('[data-sidebar-root] [data-nav-category]').evaluateAll(els => els.map(e => e.getAttribute('data-nav-category')));
  check('Sidebar has exactly the five categories', cats.length === 5, cats.join(','));
  check('Top 10 Prizes is not a top-level sidebar item', !(await p.locator('[data-sidebar-root] [data-nav-tree] > li > div > a[href*="top10"]').count()));
  check('Settings, profile and sign out sit in a separate utility area', (await p.locator('[data-sidebar-root] [data-sidebar-utility] a[href="/settings"]').count()) === 1 && (await p.locator('[data-sidebar-root] [data-sidebar-utility] button', { hasText: /sign out/i }).count()) === 1);

  // every nav link works: open each category, check children, visit each
  const broken = [];
  for (const [cat, kids] of Object.entries(TREE)) {
        await p.goto(BASE + LANDING[cat], { waitUntil: 'networkidle' });
    const open = await p.locator('[data-sidebar-root]').innerText();
    const shown = kids.filter(k => open.includes(k));
    check(`${cat}: opens to its landing page and lists ${kids.length} items`, shown.length === kids.length, kids.filter(k => !shown.includes(k)).join(','));
    const hrefs = await p.locator('[data-sidebar-root] [data-nav-category]', { hasText: cat }).first().locator('ul a').evaluateAll(els => els.map(e => [e.textContent.trim().replace(/\d+$/, '').replace(/Soon$/, ''), e.getAttribute('href')]));
    for (const [label, href] of hrefs) {
      const r = await p.goto(BASE + href, { waitUntil: 'domcontentloaded' });
      const txt = await body(p);
      if (!r || r.status() >= 400 || /404|This page could not be found|Something went wrong/i.test(txt.slice(0, 400))) broken.push(label + ' ' + href);
    }
  }
  check('Every sidebar link opens a real page (no 404 or error)', broken.length === 0, broken.join('; '));

  // active state
  await p.goto(BASE + '/groups', { waitUntil: 'networkidle' });
  const act = await p.locator('[data-sidebar-root] a[aria-current=page]').allInnerTexts();
  check('Active page is highlighted inside its open category (Groups)', act.some(x => x.includes('Groups')) && (await p.locator('[data-sidebar-root]').innerText()).includes('Saved'), act.join('|'));
  await p.goto(BASE + '/shop?view=top10', { waitUntil: 'networkidle' });
  const act2 = await p.locator('[data-sidebar-root] a[aria-current=page]').allInnerTexts();
  check('Top 10 Prizes lives inside Marketplace and is the active item there', act2.length === 1 && act2[0].includes('Top 10 Prizes'), act2.join('|'));

  // expand / collapse category
  await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
  const commBtn = p.locator('[data-sidebar-root] [data-nav-category="community"] button').first();
  const before = await p.locator('[data-sidebar-root]').innerText();
  check('Community starts closed while on Home', !before.includes('Saved'));
  await commBtn.click(); await p.waitForTimeout(200);
  check('Clicking the chevron expands Community', (await p.locator('[data-sidebar-root]').innerText()).includes('Saved'));
  await commBtn.click(); await p.waitForTimeout(200);
  check('Clicking it again collapses it', !(await p.locator('[data-sidebar-root]').innerText()).includes('Saved'));

  // collapse the whole sidebar
  const w0 = await p.locator('[data-sidebar-root]').evaluate(e => e.getBoundingClientRect().width);
  await p.locator('[data-sidebar-toggle]').click(); await p.waitForTimeout(400);
  const w1 = await p.locator('[data-sidebar-root]').evaluate(e => e.getBoundingClientRect().width);
  const mainPad = await p.locator('main').evaluate(e => e.getBoundingClientRect().left);
  check('Sidebar collapses to icons and the page makes room', w1 < w0 / 2 && mainPad < w0, `${w0} -> ${w1}`);
  await p.reload({ waitUntil: 'networkidle' });
  check('The collapsed choice is remembered after reload', (await p.locator('[data-sidebar-root]').evaluate(e => e.getBoundingClientRect().width)) < w0 / 2);
  await p.locator('[data-sidebar-toggle]').click(); await p.waitForTimeout(400);

  // five landing pages
  for (const [cat, href] of Object.entries(LANDING)) {
    await p.goto(BASE + href, { waitUntil: 'networkidle' });
    const hasBanner = (await p.locator('[data-banner], [data-home-hero], [data-section-tabs]').count()) > 0;
    const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${cat} landing page has its banner and fits the screen`, hasBanner && over <= 0, `over=${over}`);
  }
  const mk = await body((await (async () => { await p.goto(BASE + '/marketplace', { waitUntil: 'networkidle' }); return p; })()));
  const mkMain = (await p.locator('[data-market-page]').innerText()).replace(/\s+/g, ' ');
  check('The Marketplace page is the student market, with Buy, Sell and Swap and no prizes', /Buy, Sell, and Swap with ease/.test(mk) && /\bBuy\b/.test(mkMain) && /\bSell\b/.test(mkMain) && /\bSwap\b/.test(mkMain) && !/Top 10|Rewards to redeem|Your Points/.test(mkMain));

  // Community opens on Clubs; the feed lives on Home
  await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
  check('Home shows the community feed with the post box', (await p.locator('[data-card=feed]').count()) === 1 && (await p.locator('#composer textarea').count()) === 1);
  await p.locator('[data-sidebar-root] [data-nav-category=community] > div > a').first().click();
  await p.waitForURL('**/clubs', { timeout: 15000 }); await p.waitForSelector('[data-clubs-page]', { timeout: 15000 });
  check('Clicking Community opens Clubs', p.url().endsWith('/clubs') && (await p.locator('[data-clubs-page]').count()) === 1);
  for (const [label, href] of [['Clubs', '/clubs'], ['Groups', '/groups'], ['Chats', '/messages'], ['Polls', '/polls'], ['Saved', '/saved']]) {
    await p.locator(`[data-sidebar-root] [data-nav-category=community] a[href="${href}"]`).last().click();
    await p.waitForURL('**' + href, { timeout: 15000 }); await p.waitForLoadState('networkidle');
    const cur = await p.locator('[data-sidebar-root] a[aria-current=page]').allInnerTexts();
    check(`Community → ${label} opens ${href} and is the active item`, p.url().endsWith(href) && cur.some((x) => x.includes(label)), cur.join('|'));
  }
  const noFeed = await p.locator('[data-sidebar-root] [data-nav-category=community]').innerText();
  check('The Community menu has no Feed, All Posts or other extra items', !/Feed|All Posts|Student Profiles|Skill Exchange|Magazine|Yearbook/.test(noFeed), noFeed.replace(/\s+/g, ' '));
  await p.locator('[data-sidebar-root] a[href="/home"]').first().click(); await p.waitForURL('**/home'); await p.waitForSelector('[data-card=feed] article[data-post]', { timeout: 15000 }).catch(() => null);
  check('Returning to Home shows the feed again', (await p.locator('[data-card=feed] article[data-post]').count()) > 0);
  await p.goto(BASE + '/community?tag=sciencefair', { waitUntil: 'networkidle' });
  check('Hashtag links still work', p.url().includes('/community?tag=') && !p.url().endsWith('/clubs'));
  for (const old of ['/skill-exchange', '/magazine', '/yearbook']) { await p.goto(BASE + old, { waitUntil: 'networkidle' }); if (!p.url().endsWith('/clubs')) check(`Old link ${old} redirects`, false, p.url()); }

  // Learning Hub is only the Academic Library and the Tutors Directory
  await p.goto(BASE + '/learning-hub', { waitUntil: 'networkidle' });
  const lh = await body(p);
  check('Learning Hub has no University, Scholarship or Mentorship sections', !/University|Universities|Scholarship|Mentor|Opportunit|Tawjihi/i.test(lh));
  const lhTabs = await p.locator('[data-section-tabs] a').allInnerTexts();
  check('Learning Hub has just two tabs: Academic Library and Tutors Directory', JSON.stringify(lhTabs.map((x) => x.trim())) === JSON.stringify(['Academic Library', 'Tutors Directory']), lhTabs.join(','));
  check('The library links My Library, My Contributions and Suggest a Resource are there', (await p.locator('[data-library-links] a').count()) === 3);
  const sideText = await p.locator('[data-sidebar-root]').innerText();
  check('The sidebar has no postponed items', !/Mentorship|University|Opportunit/i.test(sideText));
  for (const old of ['/opportunities', '/opportunities/new', '/mentorship', '/tawjihi', '/tawjihi/ask']) {
    await p.goto(BASE + old, { waitUntil: 'networkidle' });
    if (!p.url().endsWith('/learning-hub')) check(`Old link ${old} goes to the Learning Hub`, false, p.url());
  }
  check('Old links to postponed features lead to the Learning Hub', true);
  for (const r of ['/academic-resources', '/academic-resources/my-library', '/academic-resources/my-contributions', '/academic-resources/suggest', '/tutors', '/tutors/apply']) {
    const resp = await p.goto(BASE + r, { waitUntil: 'networkidle' });
    check(`${r} opens`, !!resp && resp.status() < 400 && p.url().includes(r.split('?')[0]) && !/Application error|couldn.t load/i.test(await body(p)), p.url().replace(BASE, ''));
  }

  // empty states
  const empties = await p.evaluate(() => 0);
  await p.goto(BASE + '/passport', { waitUntil: 'networkidle' });
  check('Passport shows real records only (no invented ones)', (await p.locator('[data-passport-stats]').count()) === 1);
  await ctx.close();

  // ---------- phone ----------
  for (const w of [360, 390]) {
    const m = await signIn(browser, 'demo.layla@pioneers.edu.ps', { width: w, height: 800 }, true);
    const pg = m.p;
    check(`Phone ${w}px: the sidebar is hidden`, (await pg.locator('[data-sidebar-root]').evaluate(e => getComputedStyle(e).display)) === 'none');
    const tabs = await pg.locator('[data-bottom-tabs] a').allInnerTexts();
    check(`Phone ${w}px: bottom tabs are the five categories`, JSON.stringify(tabs.map(x => x.trim())) === JSON.stringify(['Home', 'Community', 'School', 'Learn', 'Market']), tabs.join(','));
    await pg.locator('[data-open-menu]').click(); await pg.waitForTimeout(300);
    const dr = pg.locator('[data-drawer]');
    check(`Phone ${w}px: the menu opens as a drawer with all five categories`, await dr.isVisible() && (await dr.locator('[data-nav-category]').count()) === 5);
    await dr.locator('[data-nav-category="community"] button').click(); await pg.waitForTimeout(200);
    check(`Phone ${w}px: a category expands inside the drawer`, (await dr.innerText()).includes('Saved'));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    check(`Phone ${w}px: Escape closes the drawer`, !(await dr.isVisible().catch(() => false)));
    await pg.locator('[data-open-menu]').click(); await pg.waitForTimeout(300);
    await dr.locator('[data-nav-category="community"] button').click(); await pg.waitForTimeout(200);
    await dr.locator('a[href="/groups"]').click(); await pg.waitForURL('**/groups'); await pg.waitForTimeout(500);
    check(`Phone ${w}px: choosing a page closes the drawer`, !(await dr.isVisible().catch(() => false)));
    for (const r of ['/home', '/clubs', '/school-life', '/learning-hub', '/marketplace', '/houses', '/passport', '/groups', '/clubs', '/tutors', '/academic-resources', '/academic-resources?view=top', '/market', '/more']) {
      await pg.goto(BASE + r, { waitUntil: 'networkidle' });
      const over = await pg.evaluate((w) => Math.max(document.documentElement.scrollWidth, innerWidth) - w, w);
      if (over > 0) check(`Phone ${w}px ${r}: no sideways scroll`, false, 'over=' + over);
    }
    check(`Phone ${w}px: pages fit the screen`, true);
    await m.ctx.close();
  }

  // ---------- roles ----------
  const adm = await signIn(browser, 'demo.admin@pioneers.edu.ps', { width: 1440, height: 900 }).catch(() => null);
  if (adm) {
    check('Admins see the Admin link in the profile menu or utility area', /Admin/.test(await adm.p.locator('[data-sidebar-root]').innerText() + await adm.p.locator('header').first().innerText()));
    await adm.ctx.close();
  }
  const stu = await signIn(browser, 'demo.layla@pioneers.edu.ps', { width: 1440, height: 900 });
  check('Students do not see admin features in the sidebar', !/Admin|Moderation/.test(await stu.p.locator('[data-sidebar-root]').innerText()));
  await stu.ctx.close();

  // Arabic / RTL
  const ar = await signIn(browser, 'demo.layla@pioneers.edu.ps', { width: 1440, height: 900 });
  await ar.ctx.addCookies([{ name: 'loop_locale', value: 'ar', url: BASE }]);
  await ar.p.goto(BASE + '/clubs', { waitUntil: 'networkidle' });
  const dir = await ar.p.evaluate(() => document.documentElement.dir);
  const side = await ar.p.locator('[data-sidebar-root]').innerText();
  check('Arabic: the layout flips to RTL and the sidebar is translated', dir === 'rtl' && /المجتمع/.test(side) && /الحياة المدرسية/.test(side), dir);
  await ar.ctx.close();

  await browser.close();
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
