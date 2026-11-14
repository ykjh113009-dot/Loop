const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();
const ID = { rania: '00000000-0000-0000-0000-0000000000a1', layla: '00000000-0000-0000-0000-0000000000a3', yousef: '00000000-0000-0000-0000-0000000000a4', maya: '00000000-0000-0000-0000-0000000000a5' };
const go = (p, path) => p.goto(BASE + path, { waitUntil: 'networkidle' });
const waitText = (p, re, t = 20000) => p.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re.source, { timeout: t });
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const localInput = (d) => { const f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Hebron', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d); return f.replace(' ', 'T'); };

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
  const ids = Object.values(ID).map((i) => `'${i}'`).join(',');
  sql(`delete from public.notifications where recipient_id in (${ids}) and kind in ('event_update','event_waitlist','council_reply','council_message'); delete from public.rate_events where profile_id in (${ids}); delete from public.events where title like 'E2E %'; delete from public.volunteer_opportunities where title like 'E2E %'; delete from public.council_posts where title like 'E2E %'; delete from public.council_messages where subject like 'E2E %'; delete from public.leadership_roles where profile_id='${ID.layla}' and kind='council_member'; delete from public.points_ledger where profile_id='${ID.yousef}' and reason='volunteer' and source_id in (select id from public.volunteer_entries where organization like 'E2E %');`);
  sql(`insert into public.leadership_roles (school_id, profile_id, kind, scope) select school_id, id, 'council_member', 'Secretary' from public.profiles where id='${ID.layla}';`);
  const rania = await login(browser, 'Rania Haddad');
  const maya = await login(browser, 'Maya Odeh');
  const yousef = await login(browser, 'Yousef Saleh');
  const layla = await login(browser, 'Layla Nasser');
  const mobile = await login(browser, 'Yousef Saleh', { width: 390, height: 800 });

  const start = new Date(Date.now() + 3 * 24 * 3600 * 1000); start.setMinutes(0, 0, 0);
  let id, oppId;

  // 1. A student proposes an event; an admin approves it
  {
    const p = maya.p;
    await go(p, '/events/new');
    check('A student is told their event goes to an admin first', /An admin will approve|Anyone can suggest/.test(await text(p)));
    await p.fill('input[name=title]', 'E2E Open day');
    await p.selectOption('select[name=category]', 'community');
    await p.fill('input[name=starts_at]', localInput(start));
    await p.fill('input[name=location]', 'School yard');
    await p.fill('textarea[name=description]', 'Come and see what our school offers.');
    await p.getByRole('button', { name: /Send for approval/ }).click();
    await p.waitForURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20000 });
    id = p.url().split('/').pop();
    await waitText(p, /Waiting for an admin/);
    check('A student proposal is pending', sql(`select status from public.events where id='${id}'`) === 'pending');
  }
  {
    const p = yousef.p;
    await go(p, '/events?view=list&q=E2E');
    check('Other students do not see a proposal', !/E2E Open day/.test(await text(p)));
  }
  {
    const p = rania.p;
    await go(p, `/events/${id}`);
    await waitText(p, /Approve and publish/);
    await p.getByRole('button', { name: 'Approve and publish' }).click();
    await waitText(p, /I'm going|Happening now|You can say you're going|going/);
    await p.waitForFunction(() => !document.body.innerText.includes('Waiting for an admin'), null, { timeout: 15000 });
    check('An admin approves the proposal', sql(`select status from public.events where id='${id}'`) === 'approved');
    check('The approved event has its own chat', sql(`select count(*) from public.conversations where event_id='${id}'`) === '1');
  }

  // 2. Calendar views, search and filters
  {
    const p = yousef.p;
    await go(p, '/events?view=list&q=E2E');
    check('The upcoming list finds the event by search', /E2E Open day/.test(await text(p)));
    await go(p, '/events?view=list&category=sports&q=E2E');
    check('The category filter hides other events', !/E2E Open day/.test(await text(p)));
    await go(p, '/events?view=list&category=community');
    check('The category filter shows matching events', /E2E Open day/.test(await text(p)));
    const dayKey = localInput(start).slice(0, 10);
    await go(p, `/events?view=day&date=${dayKey}`);
    check('The day view shows the day\'s events', /E2E Open day/.test(await text(p)));
    await go(p, `/events?view=week&date=${dayKey}`);
    check('The week view shows seven days', /E2E Open day/.test(await text(p)) && (await p.locator('section[id^=day-]').count()) === 7);
    await go(p, `/events?view=month&month=${dayKey.slice(0, 7)}`);
    check('The month view still works', /E2E Open day/.test(await text(p)));
  }

  // 3. Capacity and waiting list
  {
    const p = maya.p; // the creator is an organizer and can edit
    await go(p, `/events/${id}/edit`);
    await p.fill('input[name=capacity]', '1');
    await p.getByRole('button', { name: 'Save changes' }).click();
    await p.waitForURL(`**/events/${id}`, { timeout: 20000 });
    check('The organizer can set a limit', sql(`select capacity from public.events where id='${id}'`) === '1');
  }
  {
    const p = yousef.p;
    await go(p, `/events/${id}`);
    await p.getByRole('button', { name: "I'm going" }).click();
    await waitText(p, /You're going/);
    check('The first student goes', sql(`select status from public.event_rsvps where event_id='${id}' and profile_id='${ID.yousef}'`) === 'going');
  }
  {
    const p = layla.p;
    await go(p, `/events/${id}`);
    await p.getByRole('button', { name: /Join the waiting list/ }).click();
    await waitText(p, /waiting list/);
    check('The second student goes on the waiting list', sql(`select status from public.event_rsvps where event_id='${id}' and profile_id='${ID.layla}'`) === 'waitlist');
  }
  {
    const p = yousef.p;
    await go(p, `/events/${id}`);
    await p.getByRole('button', { name: /Cancel/ }).click();
    await waitText(p, /I'm going|Join the waiting list/);
    await p.waitForTimeout(500);
    check('When someone leaves, the waiting list moves up', sql(`select status from public.event_rsvps where event_id='${id}' and profile_id='${ID.layla}'`) === 'going');
    check('The chat follows who is going', sql(`select count(*) from public.conversation_members m join public.conversations c on c.id=m.conversation_id where c.event_id='${id}' and m.profile_id='${ID.layla}'`) === '1');
  }

  // 4. Organizer announcement
  {
    const p = maya.p;
    await go(p, `/events/${id}`);
    await p.fill('input[name=title]', 'Bring a hat');
    await p.getByRole('button', { name: /Tell everyone involved/ }).click();
    await waitText(p, /Posted/);
    await go(p, `/events/${id}`);
    check('An announcement shows in the event updates', /Bring a hat/.test(await text(p)));
    check('People going are notified', sql(`select count(*) from public.notifications where kind='event_update' and recipient_id='${ID.layla}'`) === '1');
  }

  // 5. Volunteering: add a role, apply, accept, record hours
  {
    const p = maya.p;
    await go(p, `/volunteering/new?event=${id}`);
    await p.fill('input[name=title]', 'E2E Welcome desk');
    await p.fill('input[name=spots]', '2');
    await p.getByRole('button', { name: 'Publish' }).click();
    await p.waitForURL(/\/volunteering\/manage\/[0-9a-f-]{36}$/, { timeout: 20000 });
    oppId = p.url().split('/').pop();
    check('An organizer adds a volunteer role to their event', sql(`select event_id from public.volunteer_opportunities where id='${oppId}'`) === id);
  }
  {
    const p = yousef.p;
    await go(p, `/events/${id}`);
    await waitText(p, /Volunteer for this event/);
    await p.getByRole('button', { name: 'Apply to volunteer' }).click();
    await waitText(p, /Sent|Waiting/);
    check('A student applies to volunteer', sql(`select status from public.volunteer_applications where opportunity_id='${oppId}'`) === 'pending');
  }
  {
    const p = maya.p;
    await go(p, `/volunteering/manage/${oppId}`);
    await p.fill('input[name=responsibility]', 'Hand out name tags');
    await p.getByRole('button', { name: 'Accept' }).click();
    await waitText(p, /Volunteers \(1\)/);
    check('The organizer accepts and assigns a role', sql(`select status || '|' || responsibility from public.volunteer_applications where opportunity_id='${oppId}'`) === 'accepted|Hand out name tags');
    check('An accepted volunteer joins the event chat', sql(`select count(*) from public.conversation_members m join public.conversations c on c.id=m.conversation_id where c.event_id='${id}' and m.profile_id='${ID.yousef}'`) === '1');
  }
  {
    const p = yousef.p;
    await go(p, '/volunteering?tab=mine');
    check('The volunteer sees their assignment', /Hand out name tags/.test(await text(p)));
  }
  {
    const p = maya.p;
    await go(p, `/volunteering/manage/${oppId}`);
    await p.fill('input[name=hours]', '2');
    await p.getByRole('button', { name: /record hours/ }).click();
    await waitText(p, /Done \(1\)/);
    check('Recording hours pays points once', sql(`select coalesce(sum(points),0) from public.points_ledger where profile_id='${ID.yousef}' and reason='volunteer' and source_id in (select id from public.volunteer_entries where organization like 'E2E %')`) === '20');
  }
  {
    const p = yousef.p;
    await go(p, `/profile/${ID.yousef}`);
    check('Verified volunteering shows on the profile', /E2E Welcome desk/.test(await text(p)));
  }

  // 6. Student council hub
  {
    const p = layla.p;
    await go(p, '/council');
    await p.getByText('Post news').click();
    await p.fill('input[name=title]', 'E2E Spirit week');
    await p.fill('textarea[name=body]', 'Dress up all week!');
    await p.getByRole('button', { name: 'Post', exact: true }).click();
    await waitText(p, /Posted|E2E Spirit week/);
    await go(p, '/council');
    check('The council posts an announcement', /E2E Spirit week/.test(await text(p)));
  }
  {
    const p = yousef.p;
    await go(p, '/council');
    check('Students can read council news', /E2E Spirit week/.test(await text(p)));
    await p.fill('input[name=subject]', 'E2E More lockers');
    await p.fill('textarea[name=body]', 'Could we ask for more lockers in grade 11?');
    await p.getByRole('button', { name: 'Send to the council' }).click();
    await waitText(p, /Waiting for a reply/);
    check('A student can write to the council', sql(`select count(*) from public.council_messages where subject like 'E2E %'`) === '1');
  }
  {
    const p = layla.p;
    await go(p, '/council');
    if (!(await p.locator('textarea[name=reply]').first().isVisible())) await p.getByText(/Messages from students/).click();
    await p.fill('textarea[name=reply]', 'We will ask the principal.');
    await p.getByRole('button', { name: 'Reply', exact: true }).click();
    await p.waitForTimeout(1500);
    check('The council can reply', sql(`select status from public.council_messages where subject like 'E2E %'`) === 'answered');
  }
  {
    const p = yousef.p;
    await go(p, '/council');
    check('The student sees the reply', /We will ask the principal/.test(await text(p)));
  }
  {
    const p = maya.p;
    await go(p, '/council');
    check('Other students cannot read messages to the council', !/E2E More lockers/.test(await text(p)));
  }

  // 7. Phones
  {
    const p = mobile.p;
    for (const path of ['/events', '/events?view=week', '/events?view=list', `/events/${id}`, '/volunteering', '/council']) {
      await go(p, path);
      check(`No sideways scrolling on a phone: ${path.replace(id, ':id')}`, await noSideScroll(p));
    }
  }

  sql(`delete from public.events where title like 'E2E %'; delete from public.volunteer_entries where organization like 'E2E %'; delete from public.council_posts where title like 'E2E %'; delete from public.council_messages where subject like 'E2E %'; delete from public.leadership_roles where profile_id='${ID.layla}' and kind='council_member'; delete from public.points_ledger where profile_id in (${ids}) and reason='volunteer' and source_id not in (select id from public.volunteer_entries);`);
  await browser.close();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
