const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const BASE = 'http://localhost:3000';
const results = [];
const check = (name, ok, info = '') => { results.push([ok, name]); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();
const ID = { layla: '00000000-0000-0000-0000-0000000000a3', yousef: '00000000-0000-0000-0000-0000000000a4', maya: '00000000-0000-0000-0000-0000000000a5', omar: '00000000-0000-0000-0000-0000000000a2' };
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const go = (p, path) => p.goto(BASE + path, { waitUntil: 'networkidle' });

async function login(browser, name, viewport = { width: 1280, height: 850 }) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  await go(p, '/login');
  await p.locator('.lp-demo button', { hasText: name }).click();
  await p.waitForURL('**/home', { timeout: 20000 });
  return { ctx, p };
}
const waitText = (p, re, t = 15000) => p.waitForFunction((s) => new RegExp(s).test(document.body.innerText), re.source, { timeout: t });

(async () => {
  const browser = await chromium.launch();
  // clean slate between the people used here
  sql(`delete from public.conversations c where c.kind='direct' and (select count(*) from public.conversation_members m where m.conversation_id=c.id and m.profile_id in ('${ID.layla}','${ID.yousef}','${ID.maya}','${ID.omar}'))=2; delete from public.blocks;`);

  const layla = await login(browser, 'Layla Nasser');
  const maya = await login(browser, 'Maya Odeh');
  const yousef = await login(browser, 'Yousef Saleh');

  // ---------- Feed
  {
    const p = layla.p;
    const audience = await p.locator('#composer-audience option').allInnerTexts();
    check('The composer can post to the whole school or a club', /Whole school/.test(audience[0]) && audience.length > 1, audience.join(' | '));
    await p.fill('#composer textarea', 'Science fair on Thursday! #ScienceFair come and see @demomaya');
    await p.locator('#composer').getByRole('button', { name: 'Post', exact: true }).click();
    await waitText(p, /Science fair on Thursday/);
    check('A school-wide post appears in the feed', sql(`select count(*) from public.posts where club_id is null and body like 'Science fair%'`) === '1');
    await p.locator('#composer [role=radio]', { hasText: 'Poll' }).click();
    await p.fill('#composer textarea', 'Best break snack?');
    await p.fill('#composer input[aria-label="Choice 1"]', 'Manakeesh');
    await p.fill('#composer input[aria-label="Choice 2"]', 'Fruit');
    await p.locator('#composer').getByRole('button', { name: 'Post', exact: true }).click();
    await waitText(p, /Best break snack/);
    check('A poll post is created with its choices', sql(`select count(*) from public.post_poll_options o join public.posts p on p.id=o.post_id where p.body='Best break snack?'`) === '2');
    await go(p, '/community');
    await p.locator('a', { hasText: '#ScienceFair' }).first().click();
    await p.waitForURL('**/community?tag=sciencefair');
    check('Tapping a hashtag shows the posts with it', (await p.locator('article[data-post]').count()) === 1 && /#sciencefair/.test(await text(p)));
  }
  const postId = sql(`select id from public.posts where body like 'Science fair%'`);
  const pollId = sql(`select id from public.posts where body='Best break snack?'`);
  {
    const p = maya.p;
    await go(p, '/notifications');
    check('A mention sends a notification', /mentioned you/.test(await text(p)));
    await go(p, '/community');
    const card = p.locator(`article[data-post="${postId}"]`);
    await card.getByRole('button', { name: 'Like', exact: true }).click();
    await p.waitForTimeout(1200);
    await p.reload({ waitUntil: 'networkidle' });
    check('A like is saved and counted', (await p.locator(`article[data-post="${postId}"] [data-testid=reaction-count]`).innerText()) === '1' && sql(`select reaction_count from public.posts where id='${postId}'`) === '1');
    await p.locator(`article[data-post="${postId}"]`).getByRole('button', { name: 'Choose a reaction' }).click();
    await p.locator(`article[data-post="${postId}"] [role=menuitem][aria-label=love]`).click();
    await p.waitForTimeout(1200);
    check('The reaction can be changed', sql(`select kind from public.post_reactions where post_id='${postId}'`) === 'love');
    await p.locator(`article[data-post="${postId}"]`).getByRole('button', { name: 'Save', exact: true }).click();
    await p.waitForTimeout(1000);
    await go(p, '/saved');
    check('Saved posts are listed on the Saved page', (await p.locator(`article[data-post="${postId}"]`).count()) === 1);
    const poll = p.locator(`article[data-post="${pollId}"]`);
    await go(p, '/community');
    await p.locator(`article[data-post="${pollId}"] button`, { hasText: 'Fruit' }).click();
    await waitText(p, /100%/);
    check('Voting in a poll shows the results', /1 vote/.test(await p.locator(`article[data-post="${pollId}"]`).innerText()));
    await p.locator(`article[data-post="${postId}"]`).getByRole('button', { name: 'Share' }).click();
    await waitText(p, /Shared to your school/);
    check('A post can be shared', sql(`select count(*) from public.posts where repost_of='${postId}'`) === '1');
    await go(p, `/post/${postId}`);
    await p.fill('input[name=body][placeholder^="Write a comment"]', 'I will be there!');
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    await waitText(p, /I will be there!/);
    check('A comment appears under the post', /Comments \(1\)/.test(await text(p)));
  }
  {
    const p = layla.p;
    await go(p, `/post/${postId}`);
    await p.locator('summary', { hasText: 'Reply' }).first().click();
    await p.fill('input[placeholder^="Write a reply"]', 'Great, see you!');
    await p.locator('details').getByRole('button', { name: 'Reply' }).click();
    await waitText(p, /Great, see you!/);
    check('A reply is nested under the comment', sql(`select count(*) from public.post_comments where parent_id is not null`) === '1');
    await go(p, '/notifications');
    const n = await text(p);
    check('The author is told about reactions, comments and shares', /reacted to your post/.test(n) && /New comment/.test(n) && /shared/i.test(n));
  }

  // ---------- Follow and friends
  {
    const p = maya.p;
    await go(p, `/profile/${ID.layla}`);
    await p.getByRole('button', { name: 'Follow', exact: true }).click();
    await p.getByRole('button', { name: 'Following', exact: true }).waitFor({ timeout: 15000 });
    await p.getByRole('button', { name: 'Add friend' }).click();
    await p.getByRole('button', { name: 'Request sent' }).waitFor({ timeout: 15000 });
    check('A student can follow and send a friend request', sql(`select count(*) from public.follows`) === '1' && sql(`select count(*) from public.friend_requests where status='pending'`) === '1');
  }
  {
    const p = layla.p;
    await go(p, '/friends');
    await p.getByRole('button', { name: 'Accept', exact: true }).click();
    await waitText(p, /No requests waiting/);
    await go(p, `/profile/${ID.layla}`);
    const t = await text(p);
    check('Accepting makes them friends, and counts show on the profile', /1 Friends/.test(t) && /1 Followers/.test(t) && sql(`select count(*) from public.friendships`) === '1', t.slice(0, 200));
    await go(p, `/profile/${ID.layla}/connections?tab=friends`);
    check('The friends list shows the new friend', /Maya Odeh/.test(await text(p)));
    // profile extras
    await go(p, '/profile/edit');
    await p.fill('input[aria-label^="Class letter"]', 'a');
    await p.locator('input[placeholder^="Drawing"]').fill('Robotics, Drawing');
    await p.locator('input[placeholder^="Physics"]').fill('Physics');
    await p.locator('[role=radio][aria-label=Sky]').click();
    await p.screenshot({ path: '/tmp/cover.png', clip: { x: 0, y: 0, width: 300, height: 120 } });
    await p.setInputFiles('input[aria-label="Cover photo"]', '/tmp/cover.png');
    await p.locator('.card', { hasText: 'Photo, class and more' }).getByRole('button', { name: 'Save' }).click();
    await waitText(p, /Saved!/);
    await go(p, `/profile/${ID.layla}`);
    const t2 = await text(p);
    const cover = await p.locator('[data-testid=cover]').getAttribute('style');
    check('Skills, subjects, class, accent and cover photo show on the profile', /Robotics/.test(t2) && /Physics/.test(t2) && /Grade 10A/.test(t2) && /@demolayla/.test(t2) && /url\(/.test(cover), cover.slice(0, 60));
    check('The profile lists the student\'s own posts', (await p.locator('article[data-post]').count()) >= 2);
  }

  // ---------- Settings: privacy, notifications
  {
    const p = layla.p;
    await go(p, '/settings');
    await p.selectOption('select[name=who_can_message]', 'friends');
    await p.uncheck('input[name=notifications_enabled]');
    await p.getByRole('button', { name: 'Save settings' }).click();
    await waitText(p, /Saved\./);
    check('Settings are saved', sql(`select who_can_message||notifications_enabled from public.profile_settings where profile_id='${ID.layla}'`) === 'friendsfalse');
  }
  {
    const p = yousef.p;
    await go(p, `/profile/${ID.layla}`);
    await p.getByRole('button', { name: 'Message', exact: true }).click();
    await p.waitForURL('**/messages/*');
    await p.fill('input[aria-label=Message]', 'Hi Layla, can I ask about the robotics club?');
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    await waitText(p, /Your message request was sent/);
    check('Messaging a non-friend sends a message request and then waits', (await p.locator('input[aria-label=Message]').count()) === 0);
  }
  {
    const p = layla.p;
    check('With notifications off the request is silent', sql(`select bool_and(silent) from public.notifications where recipient_id='${ID.layla}' and kind='message_request'`) === 't');
    await go(p, '/messages');
    check('The chat list marks it as a message request', /Message request/.test(await text(p)));
    await p.locator('a', { hasText: 'Yousef Saleh' }).click();
    await waitText(p, /wants to message you/);
    check('The request must be accepted before replying', (await p.locator('input[aria-label=Message]').count()) === 0);
    await p.getByRole('button', { name: 'Accept', exact: true }).click();
    await p.locator('input[aria-label=Message]').waitFor({ timeout: 15000 });
    await p.fill('input[aria-label=Message]', 'Sure, ask away');
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    await waitText(p, /Sure, ask away/);
    check('After accepting, both can chat', sql(`select count(*) from public.messages m join public.conversations c on c.id=m.conversation_id where c.kind='direct' and m.body in ('Sure, ask away','Hi Layla, can I ask about the robotics club?')`) === '2');
  }

  // ---------- Group chat, attachment, reaction
  {
    const p = yousef.p;
    await go(p, '/messages/new');
    await p.fill('input[name=title]', 'Physics study group');
    for (const id of [ID.maya, ID.omar, ID.layla]) await p.check(`input[name=member][value="${id}"]`);
    await p.getByRole('button', { name: 'Create group' }).click();
    await p.waitForURL('**/messages/*');
    const members = sql(`select count(*) from public.conversation_members m join public.conversations c on c.id=m.conversation_id where c.title='Physics study group'`);
    check('A group chat is created; a student who only accepts friends is skipped', members === '3', members);
    await p.fill('input[aria-label=Message]', 'Welcome everyone');
    await p.getByRole('button', { name: 'Send', exact: true }).click();
    await waitText(p, /Welcome everyone/);
    await p.setInputFiles('input[type=file]', '/tmp/cover.png');
    await p.locator('img[alt=Attachment]').waitFor({ timeout: 20000 });
    check('A photo can be sent in a chat', sql(`select count(*) from public.messages where attachment_kind='image'`) === '1');
  }
  {
    const p = maya.p;
    await go(p, '/messages');
    await p.locator('a', { hasText: 'Physics study group' }).click();
    await waitText(p, /Welcome everyone/);
    await p.locator('summary[aria-label=React]').first().click();
    await p.locator('details[open] button', { hasText: '❤️' }).click();
    await p.waitForTimeout(1500);
    check('A message reaction is saved', sql(`select count(*) from public.message_reactions`) === '1');
    check('The group shows member names and the photo', /Yousef/.test(await text(p)) && (await p.locator('img[alt=Attachment]').count()) === 1);
  }

  // ---------- Arabic and right-to-left
  {
    const p = yousef.p;
    await go(p, '/settings');
    await p.selectOption('select[name=locale]', 'ar');
    await p.getByRole('button', { name: 'Save settings' }).click();
    await waitText(p, /تم الحفظ/);
    await go(p, '/home');
    const st = await p.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, nav: document.querySelector('aside nav')?.innerText || '' }));
    const body = await text(p);
    check('Arabic switches the page to right-to-left', st.dir === 'rtl' && st.lang === 'ar', JSON.stringify(st).slice(0, 80));
    check('The menu, greeting and feed are in Arabic', /الرئيسية/.test(st.nav) && /المجتمع/.test(st.nav) && /(صباح|مساء) الخير/.test(body) && /آخر المنشورات/.test(body));
    const side = await p.evaluate(() => document.querySelector('aside').getBoundingClientRect().left > innerWidth / 2);
    check('In Arabic the sidebar sits on the right', side);
    const bad = [];
    for (const r of ['/home', '/community', '/settings', `/profile/${ID.layla}`, '/friends', '/messages', `/post/${postId}`]) { await go(p, r); if (!(await noSideScroll(p))) bad.push(r); }
    check('Arabic desktop pages have no sideways scrolling', bad.length === 0, bad.join(', '));
    const m = await yousef.ctx.newPage(); await m.setViewportSize({ width: 375, height: 740 });
    const badM = [];
    for (const r of ['/home', '/community', '/settings', `/profile/${ID.layla}`, '/friends', '/messages', `/post/${postId}`, '/messages/new']) { await go(m, r); if (!(await noSideScroll(m))) badM.push(r); }
    check('Arabic phone pages have no sideways scrolling', badM.length === 0, badM.join(', '));
    const tabs = await m.evaluate(() => [...document.querySelectorAll('nav[aria-label=Main] li')].pop()?.innerText || '');
    check('Phone tabs are translated', /المزيد|التقويم|المجتمع|الرئيسية/.test(tabs), tabs);
    await m.close();
    await go(p, '/settings');
    await p.selectOption('select[name=locale]', 'en');
    await p.check('input[name=large_text]');
    await p.locator('button[type=submit]').first().click();
    await waitText(p, /Saved\./);
    await go(p, '/home');
    const en = await p.evaluate(() => ({ dir: document.documentElement.dir, large: document.documentElement.classList.contains('a11y-large') }));
    check('Switching back to English works, and larger text is applied', en.dir === 'ltr' && en.large, JSON.stringify(en));
  }

  // ---------- Phone layout in English
  {
    const { ctx, p } = await login(browser, 'Layla Nasser', { width: 375, height: 740 });
    const bad = [];
    for (const r of ['/home', '/community', '/saved', '/settings', `/profile/${ID.layla}`, `/profile/${ID.layla}/connections`, '/friends', '/messages', '/messages/new', `/post/${postId}`, '/profile/edit']) { await go(p, r); if (!(await noSideScroll(p))) bad.push(r); }
    check('New pages fit a 375px phone', bad.length === 0, bad.join(', '));
    await ctx.close();
  }

  // ---------- Block, deactivate, delete
  {
    const p = layla.p;
    await go(p, `/profile/${ID.yousef}`);
    await p.getByRole('button', { name: 'Block', exact: true }).click();
    await p.getByRole('button', { name: 'Unblock', exact: true }).waitFor({ timeout: 15000 });
    await go(p, '/settings');
    check('Blocked students are listed in Settings', /Yousef Saleh/.test(await p.locator('section', { hasText: 'Blocked students' }).innerText()));
  }
  {
    const p = maya.p;
    await go(p, '/settings');
    await p.locator('section', { hasText: 'Deactivate account' }).locator('input[name=sure]').check();
    await p.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await p.waitForURL('**/removed');
    await waitText(p, /Your account is deactivated/);
    check('A student can deactivate their account', /Your account is deactivated/.test(await text(p)));
    await go(layla.p, `/profile/${ID.maya}`);
    check('A deactivated profile is hidden from others', /couldn't find/i.test(await text(layla.p)));
    await go(p, '/home');
    check('While deactivated the app is closed', p.url().endsWith('/removed'));
    await p.getByRole('button', { name: 'Reactivate my account' }).click();
    await p.waitForURL('**/home');
    check('The student can reactivate', true);
    await go(p, '/settings');
    await p.fill('input[name=confirm]', 'delete please');
    await p.getByRole('button', { name: 'Delete my account' }).click();
    await waitText(p, /Type DELETE/);
    check('Deleting needs the exact confirmation word', sql(`select count(*) from public.profiles where id='${ID.maya}'`) === '1');
    await p.fill('input[name=confirm]', 'DELETE');
    await p.getByRole('button', { name: 'Delete my account' }).click();
    await p.waitForURL('**/login', { timeout: 20000 });
    check('A student can delete their own account without an admin', sql(`select count(*) from auth.users where id='${ID.maya}'`) === '0' && sql(`select count(*) from public.posts where author_id='${ID.maya}'`) === '0');
    await go(p, '/home');
    check('After deleting, the session no longer works', /\/login/.test(p.url()));
  }

  await browser.close();
  const failed = results.filter((r) => !r[0]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
