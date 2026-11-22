const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const MAYA = '00000000-0000-0000-0000-0000000000a5';
const login = async (b, email, vp = { width: 1280, height: 900 }, mobile = false) => {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator(`input[value="${email}"]`) }).locator('button').click();
  await p.waitForURL('**/home');
  return { ctx, p };
};
const go = (p, u) => p.goto(BASE + u, { waitUntil: 'networkidle' });

(async () => {
  const b = await chromium.launch();
  const { p } = await login(b, 'demo.maya@pioneers.edu.ps');
  await go(p, '/events');
  check('The calendar page has its banner and a wide layout', (await p.locator('[data-image-banner]:visible').count()) === 1 && /Be part of more|Never miss a thing/.test(await p.locator('[data-image-banner]:visible').innerText()) && (await p.locator('[data-events-page]').evaluate((e) => e.getBoundingClientRect().width)) > 700);
  check('The month grid shows the month, today in green and dots on event days', (await p.locator('[data-month-calendar]').count()) === 1 && (await p.locator('[data-month-calendar] a[href^="#day-"]').count()) >= 3);
  check('Upcoming events are rows with date, time, place and club', (await p.locator('[data-event-row]').count()) >= 3 && /\d{2}:\d{2}/.test(await p.locator('[data-event-row]').first().innerText()));
  const row = p.locator('[data-event-row]', { hasText: 'Friendly Match vs Al-Nahda' });
  await row.click();
  const dlg = p.locator('[data-event-dialog][open]');
  check('Tapping an event opens a popup with the details', (await dlg.count()) === 1 && /Friendly Match vs Al-Nahda/.test(await dlg.innerText()) && /About the Event/.test(await dlg.innerText()) && /School football field/.test(await dlg.innerText()));
  check('The popup offers Add to My Calendar, Share Event and the full page', (await dlg.locator('[data-add-calendar]').count()) === 1 && (await dlg.locator('[data-share-event]').count()) === 1 && (await dlg.locator('[data-event-full]').count()) === 1);
  await dlg.locator('[data-add-calendar]').click();
  await p.waitForFunction(() => document.querySelector('[data-event-dialog][open] [data-leave-event]'), null, { timeout: 15000 });
  check('Add to My Calendar saves the RSVP', q(`select count(*) from public.event_rsvps r join public.events e on e.id = r.event_id where r.profile_id='${MAYA}' and e.title like 'Friendly Match%'`) === '1');
  await dlg.locator('[data-leave-event]').click();
  await p.waitForFunction(() => document.querySelector('[data-event-dialog][open] [data-add-calendar]'), null, { timeout: 15000 });
  check('The same button takes it back out again', q(`select count(*) from public.event_rsvps r join public.events e on e.id = r.event_id where r.profile_id='${MAYA}' and e.title like 'Friendly Match%'`) === '0');
  await dlg.locator('button[aria-label=Close]').click();
  check('The popup closes', (await p.locator('[data-event-dialog][open]').count()) === 0);
  check('A cancelled event is marked Cancelled', /Cancelled/.test(await p.locator('[data-event-row]', { hasText: 'Book Club Movie Night' }).innerText()));

  await go(p, '/council');
  check('The council page has the banner with a suggestion button', (await p.locator('[data-council-banner]').count()) === 1 && /Your voice\. Our mission/.test(await p.locator('[data-council-banner]').innerText()) && (await p.locator('[data-send-suggestion]').count()) === 1);
  check('Council members are cards with a Message button', (await p.locator('[data-council-member]').count()) >= 3 && (await p.locator('[data-council-member] button', { hasText: 'Message' }).count()) >= 3);
  check('Have a suggestion and Upcoming Initiatives sit beside the news', (await p.locator('[data-card=suggestion]').count()) === 1 && (await p.locator('[data-card=initiatives]').count()) === 1 && (await p.locator('[data-section=news]').count()) === 1);
  await p.locator('[data-council-member] button', { hasText: 'Message' }).first().click();
  await p.waitForURL('**/messages/**', { timeout: 15000 });
  check('Message opens a chat with that member', p.url().includes('/messages/'));
  await go(p, '/council');
  check('The talk-to-the-council form and elections are still there', (await p.locator('textarea').count()) >= 1 && /Elections/i.test(await p.innerText('body')));

  const m = await login(b, 'demo.maya@pioneers.edu.ps', { width: 390, height: 844 }, true);
  for (const u of ['/events', '/council']) { await go(m.p, u); check(`No sideways scrolling on a phone: ${u}`, await m.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  await b.close();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
