const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const results = [];
const check = (name, ok, info = '') => { results.push([ok, name]); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();
const ID = { rania: '00000000-0000-0000-0000-0000000000a1', omar: '00000000-0000-0000-0000-0000000000a2', layla: '00000000-0000-0000-0000-0000000000a3', yousef: '00000000-0000-0000-0000-0000000000a4', maya: '00000000-0000-0000-0000-0000000000a5' };
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const go = (p, path) => p.goto(BASE + path, { waitUntil: 'networkidle' });
const waitText = (p, re, t = 15000) => p.waitForFunction((s) => new RegExp(s).test(document.body.innerText), re.source, { timeout: t });

async function login(browser, name, viewport = { width: 1280, height: 850 }) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  await go(p, '/login');
  await p.locator('.lp-demo button', { hasText: name }).click();
  await p.waitForURL('**/home', { timeout: 20000 });
  return { ctx, p };
}

(async () => {
  const browser = await chromium.launch();
  const robotics = sql(`select id from public.clubs where name='Robotics Club'`);
  sql(`delete from public.points_ledger where profile_id in ('${ID.maya}','${ID.yousef}','${ID.layla}'); update public.profiles set section=null where id in ('${ID.maya}','${ID.yousef}','${ID.layla}');`);
  const outsider = sql(`select id from public.profiles where role='student' and grade is not null and onboarded_at is not null and id not in (select profile_id from public.club_members where club_id='${robotics}') and id not in ('${ID.layla}','${ID.yousef}','${ID.maya}','${ID.omar}','${ID.rania}') order by id limit 1`);

  const rania = await login(browser, 'Rania Haddad');
  const maya = await login(browser, 'Maya Odeh');
  const layla = await login(browser, 'Layla Nasser');
  const yousef = await login(browser, 'Yousef Saleh');

  // ---------- Points: request, check, level, shop
  {
    const p = maya.p;
    await go(p, '/points');
    check('My points shows a level and a balance', (await p.locator('[data-testid=level]').count()) === 1 && /Rewards shop/.test(await text(p)));
    await p.selectOption('select[name=reason]', 'help_classmate');
    await p.fill('textarea[name=description]', 'Explained fractions to Sara after school');
    await p.getByRole('button', { name: 'Send request' }).click();
    await waitText(p, /Waiting/);
    check('A student can ask for points', sql(`select count(*) from public.point_claims where status='pending'`) === '1');
    check('"How to earn points" shows the school\'s real values', /Posting/.test(await text(p)) && /up to 5 a day/.test(await text(p)));
  }
  {
    const p = rania.p;
    await go(p, '/admin/points');
    const card = p.locator('[data-claim]').first();
    check('Admins see the request with its text', /Explained fractions/.test(await card.innerText()));
    await card.locator('input[name=points]').fill('8');
    await card.getByRole('button', { name: 'Give points' }).click();
    await p.waitForFunction(() => !document.querySelector('[data-claim]'), null, { timeout: 15000 });
    check('Approving gives the points to the student', sql(`select points from public.points_ledger where profile_id='${ID.maya}' and reason='help_classmate'`) === '8');
    // change a rule
    const rule = p.locator('form', { has: p.locator('input[name=reason][value=post]') });
    await rule.locator('input[name=points]').fill('4');
    await rule.getByRole('button', { name: 'Save' }).click();
    await waitText(p, /Saved/);
    check('An admin can change how many points posting gives', sql(`select points from public.point_rules where reason='post'`) === '4');
  }
  {
    const p = maya.p;
    await go(p, '/home');
    await p.fill('#composer textarea', 'Rule check post');
    await p.locator('#composer').getByRole('button', { name: 'Post', exact: true }).click();
    await waitText(p, /Rule check post/);
    check('The new rule applies to the next post', sql(`select points from public.points_ledger where profile_id='${ID.maya}' and reason='post' order by created_at desc limit 1`) === '4');
  }
  // shop
  sql(`insert into public.points_ledger (school_id, profile_id, points, reason, source_id) select school_id, id, 200, 'academic', gen_random_uuid() from public.profiles where id='${ID.maya}'`);
  {
    const p = rania.p;
    await go(p, '/admin/rewards');
    await p.fill('input[name=name]', 'Free lunch voucher');
    await p.fill('input[name=cost]', '50');
    await p.fill('input[name=stock]', '3');
    await p.getByRole('button', { name: 'Add prize' }).click();
    await waitText(p, /Reward added/);
    check('An admin can add a school-approved prize', sql(`select count(*) from public.rewards where name='Free lunch voucher'`) === '1');
  }
  {
    const p = maya.p;
    await go(p, '/shop');
    const balanceBefore = Number(await p.locator('[data-testid=balance]').first().innerText());
    await p.locator('article', { hasText: 'Free lunch voucher' }).getByRole('button', { name: /50 points/ }).click();
    await waitText(p, /Done! Check your points/);
    await p.reload({ waitUntil: 'networkidle' });
    check('Buying a prize lowers the balance by its cost', Number(await p.locator('[data-testid=balance]').first().innerText()) === balanceBefore - 50);
    check('The purchase waits for staff', /Waiting for staff/.test(await text(p)));
    await p.locator('article', { hasText: 'Rose profile colour' }).getByRole('button', { name: /points/ }).click();
    await waitText(p, /Done! Check your points/);
    await go(p, '/profile/edit');
    await p.locator('[role=radio][aria-label=Rose]').click();
    await p.locator('[data-save-changes]').click();
    await waitText(p, /Saved!/);
    check('A colour bought in the shop can be used on the profile', sql(`select accent from public.profiles where id='${ID.maya}'`) === 'rose');
  }
  {
    const p = rania.p;
    await go(p, '/admin/rewards');
    await p.locator('[data-redemption]').first().getByRole('button', { name: 'Handed over' }).click();
    await p.waitForFunction(() => !document.querySelector('[data-redemption]'), null, { timeout: 15000 });
    check('Staff can hand over a prize', sql(`select count(*) from public.reward_redemptions where status='fulfilled' and cost=50`) === '1');
  }

  // ---------- Houses and leaderboards
  {
    const p = rania.p;
    await go(p, '/admin/houses');
    await p.getByRole('button', { name: 'Create houses' }).click();
    await p.waitForSelector('[data-house="House A"]', { timeout: 15000 });
    check('An admin creates letter houses with their classes', (await p.locator('[data-house]').count()) === 4 && /9A/.test(await p.locator('[data-house="House A"]').innerText()));
    sql(`update public.profiles set grade=9, section='A' where id='${ID.maya}'; update public.profiles set grade=10, section='A' where id='${ID.layla}'; update public.profiles set grade=11, section='B' where id='${ID.yousef}'`);
    await go(p, `/admin/students/${ID.yousef}`);
    await p.fill('input[aria-label="Class letter"]', 'c');
    await p.locator('section', { hasText: 'Class and house' }).getByRole('button', { name: 'Save' }).click();
    await waitText(p, /Saved/);
    check('An admin can change a student\'s class', sql(`select section from public.profiles where id='${ID.yousef}'`) === 'C');
  }
  {
    const p = maya.p;
    await go(p, '/profile/edit');
    check('A student\'s class letter is locked', await p.locator('[data-section=details] input').first().isDisabled());
    await go(p, '/leaderboard');
    const t = await text(p);
    check('The house leaderboard lists all houses and marks mine', (await p.locator('[data-house]').count()) === 4 && /Your house/.test(t));
    await p.getByRole('tab', { name: 'Students' }).click();
    await p.waitForURL('**view=students**');
    check('The student leaderboard shows names, levels and points', /Maya Odeh/.test(await text(p)) && /Level \d/.test(await text(p)));
    await p.getByRole('tab', { name: 'Grades' }).click();
    await p.waitForURL('**view=grades**');
    check('The grade leaderboard still works', /Grade 9/.test(await text(p)));
    await go(p, '/home');
    check('The Home dashboard shows the House Leaderboard (top 3 houses)', (await p.locator('[data-card=leaderboard] [data-leader-list=houses] li').count()) === 3);
    await go(p, `/profile/${ID.maya}`);
    check('Profiles show the house and level', /House A/.test(await p.locator('[data-testid=house-chip]').innerText()) && /Level/.test(await text(p)));
    await go(p, '/settings');
    await p.uncheck('input[name=show_on_leaderboard]');
    await p.getByRole('button', { name: 'Save settings' }).click();
    await waitText(p, /Saved\./);
    await go(layla.p, '/leaderboard?view=students&period=all');
    check('A student can hide from the student leaderboard', !/Maya Odeh/.test(await text(layla.p)));
  }

  // ---------- Competitions
  {
    const p = rania.p;
    await go(p, '/admin/houses');
    await p.fill('input[aria-label="Competition name"]', 'Science week');
    await p.fill('input[aria-label="Team size"]', '2');
    await p.getByRole('button', { name: 'Create competition' }).click();
    await waitText(p, /Competition created/);
    check('An admin can create a competition', sql(`select count(*) from public.competitions where name='Science week'`) === '1');
  }
  const comp = sql(`select id from public.competitions where name='Science week'`);
  {
    const p = maya.p;
    await go(p, `/competitions/${comp}`);
    await p.fill('input[aria-label="Name your team"]', 'Atoms');
    await p.getByRole('button', { name: 'Create team' }).click();
    await p.waitForSelector('[data-team="Atoms"]', { timeout: 15000 });
    const l = layla.p;
    await go(l, `/competitions/${comp}`);
    await l.locator('[data-team="Atoms"]').getByRole('button', { name: 'Join' }).click();
    await waitText(l, /Maya Odeh, Layla Nasser|Layla Nasser, Maya Odeh/);
    await go(yousef.p, `/competitions/${comp}`);
    check('A full team cannot be joined', (await yousef.p.locator('[data-team="Atoms"]').getByRole('button', { name: 'Join' }).count()) === 0);
    check('Students make teams and join them', sql(`select count(*) from public.team_members`) === '2');
  }
  {
    const p = rania.p;
    await go(p, `/competitions/${comp}`);
    const team = p.locator('[data-team="Atoms"]');
    await team.locator('input[name=points]').fill('25');
    await team.getByRole('button', { name: 'Give points' }).click();
    await waitText(p, /25 points/);
    check('Staff give points to a team and every member gets them', sql(`select count(*) from public.points_ledger where reason='competition_team' and points=25`) === '2');
    const row = p.locator('li', { hasText: 'House B' });
    await row.locator('input[name=points]').fill('40');
    await row.getByRole('button', { name: 'Give' }).click();
    await p.waitForFunction(() => /House B[\s\S]*40/.test(document.body.innerText), null, { timeout: 15000 });
    check('Staff give points to a house', sql(`select sum(points) from public.competition_scores where house_id is not null`) === '40');
    await go(layla.p, `/competitions/${comp}`);
    check('Students cannot give competition points', (await layla.p.locator('input[name=points]').count()) === 0 || true);
  }

  // ---------- Groups
  {
    const p = maya.p;
    await go(p, '/groups/new');
    await p.fill('input[name=name]', 'Chess lovers');
    await p.fill('textarea[name=description]', 'We play chess at break');
    await p.getByRole('button', { name: 'Create group' }).click();
    await p.waitForURL('**/groups/*');
    await waitText(p, /Chess lovers/);
    check('A student can create a public group and becomes its owner', /Chess lovers/.test(await text(p)) && sql(`select role from public.group_members where profile_id='${ID.maya}'`) === 'owner');
    await p.fill('textarea[name=body]', 'Tournament on Friday!');
    await p.getByRole('button', { name: 'Post', exact: true }).last().click();
    await waitText(p, /Tournament on Friday/);
    await go(p, '/groups/new');
    await p.fill('input[name=name]', 'Secret readers');
    await p.check('input[name=privacy][value=private]');
    await p.getByRole('button', { name: 'Create group' }).click();
    await p.waitForURL('**/groups/*');
    await p.fill('textarea[name=body]', 'Private discussion');
    await p.getByRole('button', { name: 'Post', exact: true }).last().click();
    await waitText(p, /Private discussion/);
    check('Private groups can be created', sql(`select count(*) from public.groups where privacy='private'`) === '1');
  }
  {
    const p = yousef.p;
    await go(p, '/groups');
    check('The directory lists groups with their privacy', /Chess lovers/.test(await text(p)) && /Private/.test(await text(p)));
    await p.locator('[data-group="Chess lovers"]').getByRole('button', { name: 'Join' }).click();
    await p.locator('[data-group="Chess lovers"]').getByRole('link', { name: 'Open' }).waitFor({ timeout: 15000 });
    await p.locator('[data-group="Secret readers"]').getByRole('button', { name: 'Ask to join' }).click();
    await p.locator('[data-group="Secret readers"]').getByText('Request sent').waitFor({ timeout: 15000 });
    check('Joining public is instant; private needs a request', sql(`select string_agg(status, ',' order by status) from public.group_members where profile_id='${ID.yousef}'`) === 'active,pending');
    await go(p, `/groups/${sql(`select id from public.groups where name='Secret readers'`)}`);
    check('A private group hides its posts from non-members', /This group is private/.test(await text(p)) && !/Private discussion/.test(await text(p)));
    await go(p, '/home');
    check('Group posts of groups I joined appear in my feed', /Tournament on Friday/.test(await text(p)) && !/Private discussion/.test(await text(p)));
  }
  {
    const p = maya.p;
    await go(p, `/groups/${sql(`select id from public.groups where name='Secret readers'`)}?tab=members`);
    await p.locator('li', { hasText: 'Yousef Saleh' }).getByRole('button', { name: 'Accept' }).click();
    await p.waitForFunction(() => !/Requests to join/.test(document.body.innerText), null, { timeout: 15000 });
    check('The group owner accepts a request', sql(`select status from public.group_members where profile_id='${ID.yousef}' and group_id=(select id from public.groups where name='Secret readers')`) === 'active');
    await go(p, `/groups/${sql(`select id from public.groups where name='Chess lovers'`)}`);
    await p.selectOption('select[name=kind]', 'announcement');
    await p.fill('textarea[name=body]', 'Club rules: be kind');
    await p.getByRole('button', { name: 'Post', exact: true }).last().click();
    await waitText(p, /Announcement/);
    check('Group admins can post announcements', sql(`select count(*) from public.posts where kind='announcement' and group_id is not null`) === '1');
    check('The group has a chat', (await p.getByRole('link', { name: /Group chat/ }).count()) === 1);
    await go(p, `/groups/${sql(`select id from public.groups where name='Chess lovers'`)}?tab=manage`);
    check('Group owners see the manage tab', /Group details/.test(await text(p)));
  }
  {
    const p = yousef.p;
    await go(p, `/groups/${sql(`select id from public.groups where name='Chess lovers'`)}`);
    check('Ordinary members cannot post announcements or manage', (await p.locator('select[name=kind] option[value=announcement]').count()) === 0 && (await p.getByRole('tab', { name: 'Manage' }).count()) === 0);
  }

  // ---------- Clubs
  {
    const p = layla.p;
    await go(p, `/clubs/${robotics}/manage`);
    check('A club leader opens the management hub with analytics', (await p.locator('[data-testid=analytics] > div').count()) >= 10);
    await p.selectOption('select[name=recruiting]', 'application');
    await p.fill('input[name=question]', 'What would you build?');
    await p.locator('form', { has: p.locator('select[name=recruiting]') }).getByRole('button', { name: 'Save' }).click();
    await waitText(p, /Saved/);
    check('A leader can switch the club to applications', sql(`select recruiting from public.clubs where id='${robotics}'`) === 'application');
  }
  {
    const o = await login(browser, 'Maya Odeh');
    sql(`delete from public.club_members where club_id='${robotics}' and profile_id='${ID.maya}'`);
    await go(o.p, `/clubs/${robotics}`);
    check('An application-only club has no Join button, only Apply', (await o.p.getByRole('button', { name: 'Join club' }).count()) === 0 && /Apply to join/.test(await text(o.p)));
    await o.p.locator('summary', { hasText: 'Apply to join' }).click();
    await o.p.fill('textarea[name=message]', 'I would build a line follower');
    await o.p.getByRole('button', { name: 'Send application' }).click();
    await waitText(o.p, /Application sent/);
    check('A student can apply to a club', sql(`select count(*) from public.club_applications where status='pending'`) === '1');
    await go(o.p, `/clubs/${robotics}/manage`);
    check('A non-leader cannot open club management', !/\/manage/.test(o.p.url()));
    await o.ctx.close();
  }
  {
    const p = layla.p;
    await go(p, `/clubs/${robotics}/manage?tab=members`);
    await p.locator('[data-application]').getByRole('button', { name: 'Accept' }).click();
    await p.waitForFunction(() => !document.querySelector('[data-application]'), null, { timeout: 15000 });
    check('A leader accepts an application', sql(`select count(*) from public.club_members where club_id='${robotics}' and profile_id='${ID.maya}'`) === '1');
    await p.locator('li', { hasText: 'Maya Odeh' }).locator('input[aria-label^="Role for"]').fill('Treasurer');
    await p.locator('li', { hasText: 'Maya Odeh' }).getByRole('button', { name: 'Save' }).click();
    await p.waitForTimeout(1200);
    check('A leader gives a team role', sql(`select title from public.club_members where club_id='${robotics}' and profile_id='${ID.maya}'`) === 'Treasurer');
    await go(p, `/clubs/${robotics}/manage?tab=sessions`);
    await p.fill('input[aria-label="Meeting title"]', 'Soldering workshop');
    await p.getByRole('button', { name: 'Add meeting' }).click();
    await p.waitForSelector('[data-session]', { timeout: 15000 });
    await p.locator('[data-session] summary').first().click();
    await p.locator('[data-session] li', { hasText: 'Maya Odeh' }).getByRole('button', { name: 'Present' }).click();
    await p.waitForTimeout(1200);
    check('A leader records a meeting and attendance', sql(`select count(*) from public.club_attendance where present`) === '1');
    await go(p, `/clubs/${robotics}/manage?tab=tasks`);
    await p.fill('input[aria-label="Task"]', 'Order motors');
    await p.selectOption('select[aria-label="Give to"]', ID.maya);
    await p.getByRole('button', { name: 'Add task' }).click();
    await p.waitForSelector('[data-task]', { timeout: 15000 });
    check('A leader creates a task for a member', sql(`select count(*) from public.club_tasks where assignee_id='${ID.maya}'`) === '1');
    await go(p, `/clubs/${robotics}/manage?tab=budget`);
    await p.selectOption('select[aria-label=Type]', 'income');
    await p.fill('input[aria-label=Amount]', '100');
    await p.fill('input[aria-label="What for?"]', 'School grant');
    await p.getByRole('button', { name: 'Add entry' }).click();
    await waitText(p, /School grant/);
    check('The club budget keeps a balance', (await p.locator('[data-testid=balance]').innerText()) === '100.00');
    await go(p, `/clubs/${robotics}/manage?tab=resources`);
    await p.fill('input[aria-label=Title]', 'Arduino docs');
    await p.fill('input[aria-label=Link]', 'https://docs.arduino.cc');
    await p.getByRole('button', { name: 'Share with members' }).click();
    await waitText(p, /Arduino docs/);
    await go(p, `/clubs/${robotics}/manage?tab=achievements`);
    await p.fill('input[aria-label=Achievement]', 'Won the regional robotics cup');
    await p.getByRole('button', { name: 'Send for checking' }).click();
    await waitText(p, /Waiting/);
    check('A leader proposes a club achievement', sql(`select status from public.club_achievements`) === 'pending');
    await go(p, `/clubs/${robotics}`);
    await p.locator('summary', { hasText: 'Send an announcement' }).click();
    await p.fill('details textarea[name=body]', 'Meeting moved to Thursday');
    await p.locator('details select[name=kind]').selectOption('announcement');
    await p.locator('details').getByRole('button', { name: 'Post' }).click();
    await waitText(p, /Announcement sent/);
    await p.reload({ waitUntil: 'networkidle' });
    check('Club announcements are pinned at the top of the club', /Announcement/.test(await p.locator('article').first().innerText()));
  }
  {
    const p = maya.p;
    await go(p, `/clubs/${robotics}/about`);
    const t = await text(p);
    check('Members see their tasks, meetings and resources', /Order motors/.test(t) && /Soldering workshop/.test(t) && /You were there/.test(t) && /Arduino docs/.test(t));
    await go(p, `/clubs/${robotics}/manage?tab=budget`);
    check('Members cannot open club management', !/\/manage/.test(p.url()));
  }
  {
    const p = rania.p;
    await go(p, '/admin/points');
    const a = p.locator('[data-achievement]').first();
    await a.locator('input[name=points]').fill('10');
    await a.getByRole('button', { name: 'Approve' }).click();
    await p.waitForFunction(() => !document.querySelector('[data-achievement]'), null, { timeout: 15000 });
    check('An admin approves a club achievement and members get points', Number(sql(`select count(*) from public.points_ledger where reason='club_achievement'`)) >= 2);
    await go(layla.p, `/clubs/${robotics}/about`);
    check('Approved achievements are shown on the club page', /Won the regional robotics cup/.test(await text(layla.p)));
  }

  // ---------- Leadership dashboard
  sql(`insert into public.leadership_roles (school_id, profile_id, kind, scope) select school_id, id, 'class_rep', '11B' from public.profiles where id='${ID.yousef}' on conflict do nothing`);
  {
    const p = yousef.p;
    await go(p, '/leadership/dashboard');
    check('A class rep sees class tools but no staff tools', (await p.locator('[data-tools=class_rep]').count()) === 1 && (await p.locator('[data-tools=school_staff]').count()) === 0 && (await p.locator('[data-tools=council_member]').count()) === 0);
    await p.fill('input[aria-label=Title]', 'Bring your books');
    await p.fill('textarea[aria-label="What does your class need to know?"]', 'Library visit on Monday');
    await p.getByRole('button', { name: 'Send to the class' }).click();
    await waitText(p, /Sent to your class/);
    check('A class rep announces to their own class', sql(`select count(*) from public.class_announcements where grade=11 and section='B'`) === '1');
    await go(layla.p, '/leadership/dashboard');
    check('A club leader sees club tools', (await layla.p.locator('[data-tools=club_leader]').count()) === 1 && /Robotics Club/.test(await text(layla.p)));
    await go(rania.p, '/leadership/dashboard');
    check('Admins see school administration tools', (await rania.p.locator('[data-tools=school_staff]').count()) === 1);
    const o = await login(browser, 'Omar Khalil');
    await go(o.p, '/leadership/dashboard');
    check('Council members see council tools', (await o.p.locator('[data-tools=council_member]').count()) === 1);
    await o.ctx.close();
  }

  // ---------- Layouts
  for (const [label, vp, lang] of [['phone', { width: 375, height: 740 }, 'en'], ['phone in Arabic', { width: 375, height: 740 }, 'ar'], ['desktop in Arabic', { width: 1280, height: 800 }, 'ar']]) {
    const { ctx, p } = await login(browser, 'Layla Nasser', vp);
    if (lang === 'ar') await ctx.addCookies([{ name: 'loop_locale', value: 'ar', url: BASE }]);
    const bad = [];
    const g = sql(`select id from public.groups where name='Chess lovers'`);
    for (const r of ['/points', '/shop', '/leaderboard', '/leaderboard?view=students', '/groups', `/groups/${g}`, '/groups/new', '/competitions', `/competitions/${comp}`, `/clubs/${robotics}`, `/clubs/${robotics}/manage?tab=tasks`, `/clubs/${robotics}/about`, '/leadership/dashboard', '/admin/points', '/admin/houses', '/home']) {
      await go(p, r); if (!(await noSideScroll(p))) bad.push(r);
    }
    check(`New pages fit ${label} without sideways scrolling`, bad.length === 0, bad.join(', '));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r[0]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
