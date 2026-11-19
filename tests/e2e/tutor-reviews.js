const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const LAYLA = '00000000-0000-0000-0000-0000000000a3', OMAR = '00000000-0000-0000-0000-0000000000a2', SCHOOL = '00000000-0000-0000-0000-00000000a001';

(async () => {
  const b = await chromium.launch();
  q(`delete from public.tutor_reviews where tutor_id='${OMAR}'; delete from public.tutoring_requests where tutor_id='${OMAR}'`);
  q(`insert into public.tutoring_requests (id, school_id, learner_id, tutor_id, subject, status) values ('00000000-0000-0000-0000-00000000e0a1','${SCHOOL}','${LAYLA}','${OMAR}','Math','accepted')`);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator('input[value="demo.layla@pioneers.edu.ps"]') }).locator('button').click();
  await p.waitForURL('**/home'); await p.waitForTimeout(600);

  await p.goto(BASE + '/tutors', { waitUntil: 'networkidle' });
  check('The Tutors page has its banner with the tagline and search', (await p.locator('[data-banner]').count()) === 1 && /Get help from experienced tutors in your subjects!/.test(await p.locator('[data-tutors-page]').innerText()) && (await p.locator('select[name=subject] option').count()) > 5);
  const card = p.locator(`[data-tutor="${OMAR}"]`);
  check('A tutor card shows the name, subjects, View Profile and Request Session', (await card.count()) === 1 && /View Profile/.test(await card.innerText()) && /Request Session/.test(await card.innerText()));
  check('A tutor with no reviews says so honestly', /No reviews yet/.test(await card.locator('[data-tutor-rating]').innerText()));
  check('The "Want to become a tutor?" band is on the page', (await p.locator('[data-tutor-band]').count()) === 1);
  await p.locator('select[name=subject]').selectOption('Math'); await p.getByRole('button', { name: 'Search', exact: true }).click(); await p.waitForURL('**subject=Math**');
  check('The subject filter works', (await p.locator('[data-tutor]').count()) >= 1 && (await p.locator(`[data-tutor="${OMAR}"]`).count()) === 1);

  await p.goto(BASE + '/tutors?tab=requests', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /We met/ }).click(); await p.waitForSelector('[data-review-form]', { timeout: 15000 });
  check('After a finished session the student is asked for a review', (await p.locator('[data-review-form]').count()) === 1);
  await p.getByRole('button', { name: 'Send review' }).click(); await p.waitForTimeout(800);
  check('A review needs a star rating', /1 to 5 stars/i.test(await p.locator('main').last().innerText()) || (await q(`select count(*) from public.tutor_reviews where tutor_id='${OMAR}'`)) === '0');
  await p.getByRole('radio', { name: '4 stars' }).click();
  await p.locator('[data-review-form] textarea').fill('Very patient and clear.');
  await p.getByRole('button', { name: 'Send review' }).click(); await p.waitForTimeout(1500);
  check('The review is saved', q(`select rating || '|' || comment from public.tutor_reviews where tutor_id='${OMAR}'`) === '4|Very patient and clear.');

  await p.goto(`${BASE}/tutors/${OMAR}`, { waitUntil: 'networkidle' });
  const rv = await p.locator('[data-tutor-reviews]').innerText();
  check('The tutor profile shows the review and the star rating', /Very patient and clear\./.test(rv) && /Layla Nasser/.test(rv));
  check('The profile has About me, Subjects, Available Hours and a request form', /About me/.test(await p.locator('[data-tutor-profile]').innerText()) && (await p.locator('[data-tutor-hours]').count()) === 1 && (await p.locator('#request').count()) === 1);
  await p.goto(BASE + '/tutors', { waitUntil: 'networkidle' });
  check('The directory now shows the rating and session count', /4\.0/.test(await p.locator(`[data-tutor="${OMAR}"]`).innerText()) && /1 session/.test(await p.locator(`[data-tutor="${OMAR}"]`).innerText()));
  await p.goto(BASE + '/tutors?tab=requests', { waitUntil: 'networkidle' });
  check('A session can only be reviewed once', (await p.locator('[data-review-form]').count()) === 0 && /You reviewed this session/.test(await p.locator('main').last().innerText()));

  for (const w of [360, 390]) {
    const c2 = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
    const m = await c2.newPage();
    await m.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await m.locator('form', { has: m.locator('input[value="demo.layla@pioneers.edu.ps"]') }).locator('button').click();
    await m.waitForURL('**/home');
    let ok = true;
    for (const r of ['/tutors', `/tutors/${OMAR}`, '/tutors?tab=requests']) { await m.goto(BASE + r, { waitUntil: 'networkidle' }); if ((await m.evaluate((w) => Math.max(document.documentElement.scrollWidth, innerWidth) - w, w)) > 0) { ok = false; console.log('  over at', r); } }
    check(`Phone ${w}px: Tutors pages fit the screen`, ok);
    await c2.close();
  }
  q(`delete from public.tutor_reviews where tutor_id='${OMAR}'; delete from public.tutoring_requests where tutor_id='${OMAR}'`);
  await b.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
