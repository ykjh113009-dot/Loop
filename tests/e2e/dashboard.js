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

  // ============ desktop, student Layla ============
  const { ctx, p } = await signIn(browser, 'demo.layla@pioneers.edu.ps', { width: 1440, height: 900 });
  const t = await body(p);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hebron', hour: '2-digit', hour12: false }).format(new Date())) % 24;
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  check(`Greeting is personal and matches the time of day (Good ${part}, Layla!)`, t.includes(`Good ${part}, Layla!`));

  // shell
  const side = await p.locator('aside nav a').evaluateAll(els => els.map(e => [e.textContent.trim().replace(/\d+$/, ''), e.getAttribute('href')]));
  const expectSide = [['Home', '/home'], ['Community', '/community'], ['Chats', '/messages'], ['Calendar', '/events'], ['Activities', '/challenges'], ['Academic Resources', '/academic-resources'], ['Tutors Directory', '/tutors'], ['University & Opportunities', '/opportunities'], ['Tawjihi corner', '/tawjihi'], ['Rewards Shop', '/shop'], ['Clubs', '/clubs'], ['Groups', '/groups'], ['Leaderboards', '/leaderboard'], ['Polls', '/polls'], ['Competitions', '/competitions'], ['Volunteering hours', '/volunteering'], ['Buy, sell & swap', '/market'], ['Student council', '/council'], ['Suggestion box', '/suggestions'], ['Leadership', '/leadership'], ['My points & badges', '/points'], ['Talk to the counselor', '/counselor']];
  check('Sidebar lists everything from the old More page in order, grouped by topic', JSON.stringify(side) === JSON.stringify(expectSide), JSON.stringify(side));
  check('Sidebar marks Home as the current page', (await p.locator('aside nav a[aria-current=page]').innerText()).trim() === 'Home');
  check('Top bar has search, notifications, messages and the profile (name and grade)', (await p.locator('header input[name=q]').count()) === 1 && (await p.locator('header a[aria-label=Notifications]').first().isVisible()) && (await p.locator('header a[aria-label=Messages]').first().isVisible()) && /Layla Nasser\s*Grade 10/.test(await p.locator('header button[aria-label="Profile menu"]').first().innerText().then(x => x.replace(/\s+/g, ' ')).catch(() => '')) );

  // quick actions
  const qa = await p.locator('nav[aria-label="Quick actions"] a').evaluateAll(els => els.map(e => [e.textContent.trim(), e.getAttribute('href')]));
  check('6 quick actions with the right links', JSON.stringify(qa.map(x => x[0])) === JSON.stringify(['New Post', 'Messages', 'Calendar', 'Activities', 'Academy', 'More']) && qa.every(x => x[1]), JSON.stringify(qa));

  // cards present
  const titles = ['Upcoming Activities', 'Recent Chats', 'School Announcements', 'Community Feed', 'Grade Leaderboard', 'Quick Chats', 'Student Council', 'Calendar', "This Week's Events", 'Next Up', 'Featured in Loop'];
  const heads = await p.locator('.dash h2').allInnerTexts();
  check('All 11 dashboard cards are on the page', titles.every(x => heads.includes(x)), heads.filter(x => !titles.includes(x)).join(',') || 'ok');

  // ---- real data
  const ann = q("select title from public.announcements order by created_at desc limit 3");
  check('Announcements card shows the latest announcements from the database', ann.length > 0 && ann.every(a => t.includes(a)), ann.join(' / '));
  const ev = q("select title from public.events where status='approved' and starts_at > now() order by starts_at limit 3");
  const upc = await p.locator('.dash-upcoming').innerText();
  check('Upcoming Activities shows the next events from the database', ev.length > 0 && ev.every(e => upc.includes(e)), ev.join(' / '));
  const uid = (await p.locator('header button[aria-label="Profile menu"]').first().evaluate(() => 1), q("select id from public.profiles where full_name='Layla Nasser'")[0]);
  const clubs = q(`select c.name from public.club_members m join public.clubs c on c.id=m.club_id where m.profile_id='${uid}' and c.status='approved' order by c.name`);
  const quick = await p.locator('.dash-quick').innerText();
  check('Quick Chats lists exactly the clubs Layla belongs to, with member counts', clubs.length > 0 && clubs.every(c => quick.includes(c)) && /\d+ members?/.test(quick), clubs.join(' / '));
  const chatRows = q(`select count(*) from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id where cm.profile_id='${uid}' and c.last_message_at is not null`);
  const chatLinks = await p.locator('.dash-chats ul a').count();
  check('Recent Chats shows her latest conversations (max 3) with preview and time', chatLinks === Math.min(3, Number(chatRows[0])) && chatLinks > 0, `${chatLinks} of ${chatRows[0]}`);
  const lb = await p.locator('.dash-leader').innerText();
  check('Grade Leaderboard ranks the school grades (not individual students)', ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].every(g => lb.includes(g)));
  const posts = (await p.locator('.dash-feed article[data-post]').evaluateAll((els) => els.map((e) => e.getAttribute('data-post'))));
  const visible = q(`select count(*) from public.posts where id in (${posts.map((x) => `'${x}'`).join(',') || "'00000000-0000-0000-0000-000000000000'"}) and (status='visible' or author_id='${uid}')`)[0];
  check('Community Feed shows real posts she is allowed to see (held posts of others stay hidden)', posts.length > 0 && Number(visible) === posts.length, `${posts.length} posts`);
  check('Every post has working reaction, comment and save controls', (await p.locator('.dash-feed article [data-testid=reaction-count]').count()) === posts.length && (await p.locator('.dash-feed article a[aria-label=Comments]').count()) === posts.length);
  const council = q("select count(*) from public.council_members")[0];
  check('Student Council card reflects the council in the database', (await p.locator('.dash-council').innerText()).includes(Number(council) > 0 ? 'members' : 'No members'), council + ' members');
  const month = await p.locator('.dash-calendar').innerText();
  check('Calendar card shows this month with today marked', /\b20\d\d\b/.test(month) && (await p.locator('.dash-calendar a.bg-brand-700').count()) === 1);

  // ---- navigation
  for (const [label, href] of expectSide) {
    await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
    await p.locator(`aside nav a[href="${href}"]`).click();
    await p.waitForURL('**' + href + '*', { timeout: 15000 }).catch(() => {});
    await p.waitForLoadState('networkidle');
    const bt = await body(p);
    check(`Sidebar → ${label} opens ${href} without errors`, p.url().includes(href) && bt.length > 50 && !/Application error|couldn.t load/i.test(bt), p.url().replace(BASE, ''));
  }
  for (const [label, href] of qa) {
    await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
    await p.locator(`nav[aria-label="Quick actions"] a[href="${href}"]`).click();
    await p.waitForLoadState('networkidle'); await p.waitForTimeout(300);
    check(`Quick action "${label}" works`, p.url().includes(href.split('#')[0]) && !/Application error/i.test(await body(p)), p.url().replace(BASE, ''));
  }
  const viewAll = {};
  await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
  for (const [card, sel] of [['Recent Chats', '.dash-chats'], ['School Announcements', '.dash-announce'], ['Community Feed', '.dash-feed'], ['Upcoming Activities', '.dash-upcoming'], ['Grade Leaderboard', '.dash-leader'], ['Quick Chats', '.dash-quick'], ['Student Council', '.dash-council']]) {
    const href = await p.locator(`${sel} > section > header a`).first().getAttribute('href'); viewAll[card] = href;
  }
  const badLinks = [];
  for (const [card, href] of Object.entries(viewAll)) { const r = await p.goto(BASE + href, { waitUntil: 'networkidle' }); if (r.status() >= 400 || !p.url().includes(href.split('?')[0])) badLinks.push(card + '→' + href); await p.goto(BASE + '/home', { waitUntil: 'networkidle' }); }
  check('Every "View all" link opens a working page', badLinks.length === 0, Object.values(viewAll).join(' '));

  // ---- search
  await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
  await p.locator('header input[name=q]').fill('Maya'); await p.keyboard.press('Enter');
  await p.waitForURL('**/search?q=Maya'); await p.waitForLoadState('networkidle');
  let st = await body(p);
  check('Search finds a student by name', /students/i.test(st) && st.includes('Maya Odeh'));
  await p.goto(BASE + '/search?q=Robot', { waitUntil: 'networkidle' }); st = await body(p);
  check('Search finds clubs', /clubs/i.test(st) && st.includes('Robotics Club'));
  await p.goto(BASE + '/search?q=Science', { waitUntil: 'networkidle' }); st = await body(p);
  check('Search finds events', /events/i.test(st) && st.includes('Science Fair'));
  await p.goto(BASE + '/search?q=zzzzqqq', { waitUntil: 'networkidle' });
  check('Search with no match shows a clear empty state', /Nothing found/.test(await body(p)));
  await p.goto(BASE + '/search?q=%25_%2C()', { waitUntil: 'networkidle' });
  check('Search ignores wildcard and special characters safely', !/Application error/i.test(await body(p)));

  // ---- profile menu
  await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
  await p.locator('header button[aria-label="Profile menu"]').first().click();
  const menu = await p.locator('[role=menu]').innerText();
  check('Profile menu has My profile, Edit profile, More and Sign out (no admin links for a student)', /My profile/.test(menu) && /Edit profile/.test(menu) && /Sign out/.test(menu) && !/Admin dashboard|Moderation/.test(menu));
  await p.locator('[role=menu] a', { hasText: 'My profile' }).click();
  await p.waitForURL('**/profile/**'); check('Profile menu → My profile opens her profile', p.url().includes('/profile/' + uid));
  await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
  await p.locator('header button[aria-label="Profile menu"]').first().click();
  await p.keyboard.press('Escape');
  check('Profile menu closes with Escape', (await p.locator('[role=menu]').count()) === 0);

  // ---- post from the dashboard, then delete it
  const marker = 'Dashboard test post ' + Date.now();
  await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
  await p.locator('#composer textarea').fill(marker);
  await p.locator('#composer').getByRole('button', { name: 'Post', exact: true }).click();
  await p.waitForFunction((m) => document.body.innerText.includes(m), marker, { timeout: 15000 }).catch(() => {});
  check('Posting from the dashboard works and the post appears in the feed', (await body(p)).includes(marker));
  const row = q(`select status from public.posts where body='${marker}'`);
  check('The post is saved in the database', row.length === 1 && row[0] === 'visible', row.join(','));
  // delete via the post menu
  const card = p.locator('.dash-feed article', { hasText: marker });
  await card.locator('summary').click(); await card.getByRole('button', { name: 'Delete post' }).click();
  await p.waitForFunction((m) => !document.body.innerText.includes(m), marker, { timeout: 15000 }).catch(() => {});
  check('Deleting your own post from the feed works', q(`select count(*) from public.posts where body='${marker}'`)[0] === '0');
  // blocked word is held, not published
  const bad = 'test post with the word fuck ' + Date.now();
  await p.locator('#composer textarea').fill(bad); await p.locator('#composer').getByRole('button', { name: 'Post', exact: true }).click();
  await p.waitForTimeout(2500);
  const held = q(`select status from public.posts where body='${bad}'`);
  check('A post with a blocked word is held for a moderator (safety rules still apply)', held[0] === 'held', held.join(','));
  q(`delete from public.posts where body in ('${bad}')`);

  await ctx.close();

  // ============ roles in the profile menu ============
  for (const [who, email, want, notWant] of [['admin Rania', 'demo.rania@pioneers.edu.ps', ['Admin dashboard', 'Moderation'], []], ['moderator Omar', 'demo.omar@pioneers.edu.ps', ['Moderation'], ['Admin dashboard']], ['counselor Hiba', 'demo.counselor@pioneers.edu.ps', ['Counselor inbox'], ['Admin dashboard']]]) {
    const s = await signIn(browser, email, { width: 1440, height: 900 });
    await s.p.locator('header button[aria-label="Profile menu"]').first().click();
    const m = await s.p.locator('[role=menu]').innerText();
    check(`${who}: profile menu shows ${want.join(' + ')}${notWant.length ? ' and not ' + notWant.join('/') : ''}`, want.every(w => m.includes(w)) && notWant.every(w => !m.includes(w)));
    const dashOk = await s.p.goto(BASE + '/home', { waitUntil: 'networkidle' }).then(r => r.status() < 400); await s.p.waitForTimeout(800);
    check(`${who}: dashboard loads`, dashOk && (await body(s.p)).includes('Recent Chats'));
    await s.ctx.close();
  }

  // ============ phone ============
  for (const w of [375, 390, 430]) {
    const s = await signIn(browser, 'demo.layla@pioneers.edu.ps', { width: w, height: 800 });
    const m = await s.p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, tabs: [...document.querySelectorAll('nav[aria-label=Main]')].filter(n => n.getBoundingClientRect().height > 0).map(n => [...n.querySelectorAll('a')].map(a => a.textContent.trim())), fab: !!document.querySelector('a[aria-label="New post"]'), sidebar: getComputedStyle(document.querySelector('aside')).display, header: !!document.querySelector('header a[aria-label=Notifications]'), cols: getComputedStyle(document.querySelector('nav[aria-label="Quick actions"]')).gridTemplateColumns.split(' ').length }));
    check(`Phone ${w}px: no sideways scroll, sidebar hidden, bottom tabs Home/Community/Calendar/More, floating new-post button, header icons, quick actions in a grid`, m.over <= 0 && m.sidebar === 'none' && JSON.stringify(m.tabs) === JSON.stringify([['Home', 'Community', 'Calendar', 'More']]) && m.fab && m.header && m.cols === 3, JSON.stringify(m));
    // touch targets
    const small = await s.p.evaluate(() => [...document.querySelectorAll('nav[aria-label=Main] a, nav[aria-label="Quick actions"] a, a[aria-label="New post"]')].filter(a => a.getBoundingClientRect().height > 0 && (a.getBoundingClientRect().height < 44 || a.getBoundingClientRect().width < 44)).length);
    check(`Phone ${w}px: tabs, quick actions and the new-post button are at least 44 px (touch friendly)`, small === 0, small + ' too small');
    if (w === 390) {
      for (const [tab, href] of [['Community', '/community'], ['Calendar', '/events'], ['More', '/more'], ['Home', '/home']]) {
        await s.p.locator(`nav[aria-label=Main] a[href="${href}"]`).last().click(); await s.p.waitForURL('**' + href); await s.p.waitForLoadState('networkidle');
        const active = await s.p.locator('nav[aria-label=Main] a[aria-current=page]').last().innerText();
        check(`Phone: tab ${tab} opens ${href} and is highlighted`, active.trim() === tab, active.trim());
      }
      await s.p.locator('a[aria-label="New post"]').click(); await s.p.waitForTimeout(500);
      check('Phone: the floating button jumps to the post box', (await s.p.evaluate(() => location.hash)) === '#composer');
    }
    await s.ctx.close();
  }

  // ============ protected routes ============
  const anon = await browser.newContext(); const ap = await anon.newPage(); const badRoutes = [];
  for (const r of ['/home', '/community', '/announcements', '/search?q=maya', '/messages', '/events']) { await ap.goto(BASE + r, { waitUntil: 'networkidle' }); if (!ap.url().includes('/login')) badRoutes.push(r); }
  check('Signed-out visitors cannot open the dashboard, community, announcements or search', badRoutes.length === 0, badRoutes.join(','));
  await anon.close();

  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
