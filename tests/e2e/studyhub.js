const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const BASE = 'http://localhost:3000';
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();
const ID = { rania: '00000000-0000-0000-0000-0000000000a1', layla: '00000000-0000-0000-0000-0000000000a3', maya: '00000000-0000-0000-0000-0000000000a5' };
const go = (p, u) => p.goto(BASE + u, { waitUntil: 'networkidle' });
const waitText = (p, re, t = 20000) => p.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re.source, { timeout: t });
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const PDF = path.join(__dirname, 'sample.pdf');

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
  sql(`delete from public.tutor_applications where profile_id='${ID.maya}'; delete from public.tutor_profiles where profile_id='${ID.maya}'; delete from public.study_resources where title like 'E2E %'; delete from public.study_opportunities where title like 'E2E %'; delete from public.top10_prizes; delete from public.top10_settings; delete from public.study_categories where slug='ap-statistics'; delete from public.rate_events where profile_id in ('${ID.maya}','${ID.rania}','${ID.layla}');`);
  const rania = await login(browser, 'Rania Haddad');
  const maya = await login(browser, 'Maya Odeh');
  const layla = await login(browser, 'Layla Nasser');
  const mobile = await login(browser, 'Maya Odeh', { width: 390, height: 800 });

  // 1. The sidebar (the full tree is covered by nav.js; here: the Study Hub destinations)
  {
    const p = maya.p;
    for (const [h, re] of [['/academic-resources', /Academic Library/], ['/tutors', /Tutors Directory/], ['/shop', /Top 10 Prizes/]]) {
      await go(p, h);
      const active = await p.locator(`[data-sidebar-root] a[href="${h}"]`).first().getAttribute('aria-current');
      check(`${h} opens its own page and is highlighted`, active === 'page' && re.test(await text(p)));
    }
    await go(p, '/shop');
    check('Top 10 Prizes is not also highlighting Activities', (await p.locator('[data-sidebar-root] a[href="/challenges"]').count()) === 0 || (await p.locator('[data-sidebar-root] a[href="/challenges"]').first().getAttribute('aria-current')) === null);
  }

  // 2. Academic resources
  {
    const p = maya.p;
    await go(p, '/academic-resources');
    const slugs = await p.locator('[data-category]').evaluateAll((els) => els.map((e) => e.getAttribute('data-category')));
    check('Academic Resources has separate category pages', ['sat', 'ap-chemistry', 'ap-biology', 'ap-physics', 'ap-calculus', 'other'].every((s) => slugs.includes(s)), slugs.join(','));
    await go(p, '/academic-resources/ap-chemistry');
    check('A category page has its own empty state', /No resources in AP Chemistry yet/.test(await text(p)));
    check('An ordinary student cannot add resources', (await p.locator('input[name=url]').count()) === 0);
  }
  {
    const p = rania.p;
    await go(p, '/academic-resources');
    await p.getByText('Add a subject').click();
    await p.fill('input[name=name]', 'AP Statistics');
    await p.getByRole('button', { name: 'Add', exact: true }).click();
    await waitText(p, /Subject added|AP Statistics/);
    await go(p, '/academic-resources');
    check('Admins can add a subject', /AP Statistics/.test(await text(p)));
  }

  // 3. Tutors Directory and the application
  {
    const p = maya.p;
    await go(p, '/tutors');
    check('The directory lists approved tutors with a profile button', (await p.locator('[data-tutor]').count()) >= 5 && (await p.getByRole('link', { name: 'View profile' }).count()) >= 5);
    check('Become a Tutor is visible', (await p.getByRole('link', { name: 'Become a Tutor' }).count()) === 1);
    check('Maya is not listed before approval', (await p.locator(`[data-tutor="${ID.maya}"]`).count()) === 0);
    await p.getByRole('link', { name: 'Become a Tutor' }).click();
    await p.waitForURL('**/tutors/apply');
    await waitText(p, /Your Information/);
    check('The application takes name and email from the account', /Maya Odeh/.test(await p.inputValue('#ta-name')) && /@pioneers\.edu\.ps/.test(await p.inputValue('#ta-email')));
    // B
    await p.selectOption('select[name=grade]', 'Grade 9');
    await p.locator('label', { hasText: /^\s*SAT\s*$/ }).click();
    await p.locator('label', { hasText: 'AP Chemistry' }).click();
    await p.fill('input[name=other_subjects]', 'Latin');
    await p.fill('textarea[name=achievements]', 'Chemistry 96');
    // C
    await p.fill('textarea[name=intro]', 'I explain chemistry step by step.');
    await p.fill('textarea[name=motivation]', 'I want to help classmates feel ready for exams.');
    // draft
    await p.getByRole('button', { name: 'Save draft' }).click();
    await waitText(p, /Draft saved/);
    check('A draft can be saved', sql(`select status from public.tutor_applications where profile_id='${ID.maya}'`) === 'draft');
    await go(p, '/tutors/apply');
    check('The draft comes back filled in', (await p.inputValue('select[name=grade]')) === 'Grade 9');
    // D, E
    await p.locator('label', { hasText: 'Mon' }).click();
    await p.fill('input[name=hours]', '15:00-17:00');
    await p.setInputFiles('input[type=file][accept*=docx]', PDF);
    await waitText(p, /sample\.pdf/).catch(async () => { console.log('UPLOAD PAGE:', (await text(p)).slice(-500)); throw new Error('upload failed'); });
    check('A document uploads into the private bucket', sql(`select count(*) from public.tutor_application_documents where size > 0`) >= '1' && sql(`select public from storage.buckets where id='tutor-docs'`) === 'f');
    check('The page shows availability and documents without extra steps', /Availability/.test(await text(p)) && /sample\.pdf/.test(await text(p)));
    await p.locator('input[name=agree]').check();
    await p.getByRole('button', { name: 'Submit application' }).click();
    await waitText(p, /Your application is with the reviewers/);
    check('Submitting sets Pending Review', sql(`select status from public.tutor_applications where profile_id='${ID.maya}'`) === 'pending');
    await go(p, '/tutors');
    check('A pending applicant is still not in the directory', (await p.locator(`[data-tutor="${ID.maya}"]`).count()) === 0 && /waiting for review/.test(await text(p)));
  }

  // privacy and permissions
  {
    const ahmad = await login(browser, 'Yousef Saleh');
    const p = ahmad.p;
    await go(p, '/tutors/review');
    check('An ordinary student cannot open the review queue', !/Pending Review/.test(await text(p)) && p.url().endsWith('/tutors'));
    const docPath = sql(`select path from public.tutor_application_documents limit 1`);
    const r = await p.request.get(`http://127.0.0.1:54321/storage/v1/object/public/tutor-docs/${docPath}`);
    check('Documents are not available through a public address', r.status() >= 400, 'status ' + r.status());
    await ahmad.ctx.close();
  }

  // review
  let appId;
  {
    const p = rania.p;
    await go(p, '/tutors/review');
    appId = await p.locator('[data-application]').first().getAttribute('data-application');
    check('Reviewers see the pending application', /Maya Odeh/.test(await text(p)));
    await go(p, `/tutors/review/${appId}`);
    check('The review page shows the details and documents', /Chemistry 96/.test(await text(p)) && /sample\.pdf/.test(await text(p)) && (await p.locator('a[href*="token="]').count()) >= 1);
    await p.getByRole('button', { name: 'Reject' }).click();
    await waitText(p, /Tell the student/);
    await p.fill('textarea[name=note]', 'Please add your latest chemistry grade.');
    await p.getByRole('button', { name: 'Reject' }).click();
    await waitText(p, /Sent back|Rejected/);
    check('A rejection needs and stores feedback', sql(`select status from public.tutor_applications where profile_id='${ID.maya}'`) === 'rejected');
  }
  {
    const p = maya.p;
    await go(p, '/tutors/apply');
    check('The applicant sees the feedback and can edit', /Please add your latest chemistry grade/.test(await text(p)) && (await p.locator('select[name=grade]').count()) === 1);
    await p.locator('input[name=agree]').check();
    await p.getByRole('button', { name: 'Submit application' }).click();
    await waitText(p, /Your application is with the reviewers/);
    check('A rejected application can be resubmitted', sql(`select count(*) from public.tutor_application_events where action='resubmit'`) >= '1');
  }
  {
    const p = rania.p;
    await go(p, `/tutors/review/${appId}`);
    check('The history keeps the earlier rejection', /Needs changes/.test(await text(p)) && /Submitted again/.test(await text(p)));
    await p.getByRole('button', { name: 'Approve' }).click();
    await waitText(p, /Approved/);
    check('Approval creates the public tutor profile', sql(`select count(*) from public.tutor_profiles where profile_id='${ID.maya}' and approved_at is not null and active`) === '1');
  }
  {
    const p = maya.p;
    await go(p, '/tutors');
    check('The approved tutor appears in the directory (also to themselves)', (await p.locator(`[data-tutor="${ID.maya}"]`).count()) === 1 && /You are an approved tutor/.test(await text(p)));
    await go(layla.p, '/tutors');
    check('Other students see the approved tutor', (await layla.p.locator(`[data-tutor="${ID.maya}"]`).count()) === 1);
    await go(layla.p, `/tutors/${ID.maya}`);
    const body = await text(layla.p);
    check('The public profile shows subjects and availability but not private details', /Latin/.test(body) && /Mon/.test(body) && !/Chemistry 96/.test(body) && !/sample\.pdf/.test(body));
    check('The full profile has a booking option', /Request a Session/.test(body));
    await go(p, '/tutors/me');
    check('The approved tutor can update their profile', (await p.locator('textarea[name=intro]').count()) === 1);
    check('An approved tutor cannot open the application again', (await go(p, '/tutors/apply'), p.url().endsWith('/tutors/me')));
  }

  // 5. Top 10 prizes (redeeming points is postponed)
  {
    const p = rania.p;
    await go(p, '/admin/rewards');
    await p.locator('form[data-place="1"] input[name=title]').fill('Pizza party');
    await p.locator('form[data-place="1"]').getByRole('button', { name: 'Save' }).click();
    await waitText(p, /Saved/);
    const q = maya.p;
    await go(q, '/shop');
    check('The shop page is the Top 10 prizes', /Top 10 student prizes/.test(await text(q)) && /Pizza party/.test(await text(q)) && /Ranking period/.test(await text(q)));
    check('There is nothing to redeem', (await q.locator('[data-reward]').count()) === 0 && (await q.locator('[data-testid=balance]').count()) === 0 && !/Redeem/.test(await text(q)));
    check('The old Top 10 link still works', (await go(q, '/shop?tab=top10'), /Top 10 student prizes/.test(await text(q))));
    check('The sidebar has one Top 10 Prizes item', (await q.locator('[data-sidebar-root] [data-nav-tree] a', { hasText: /top 10 prizes/i }).count()) === 1);
  }

  // 6. Phones
  {
    const p = mobile.p;
    for (const u of ['/academic-resources', '/academic-resources/sat', '/tutors', `/tutors/${ID.layla}`, '/tutors/apply', '/shop', '/shop?tab=top10', '/more']) {
      await go(p, u);
      check(`No sideways scrolling on a phone: ${u}`, await noSideScroll(p));
    }
    await go(p, '/more');
    check("On a phone, the Study Hub is reachable from the menu", (await p.locator("main [data-nav-group=\"Learning Hub\"] a").count()) === 3 && /Tutors Directory/i.test(await text(p)));
  }
  sql(`delete from public.tutor_applications where profile_id='${ID.maya}'; delete from public.tutor_profiles where profile_id='${ID.maya}'; delete from public.study_resources where title like 'E2E %'; delete from public.study_opportunities where title like 'E2E %'; delete from public.top10_prizes; delete from public.study_categories where slug='ap-statistics';`);
  await browser.close();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
