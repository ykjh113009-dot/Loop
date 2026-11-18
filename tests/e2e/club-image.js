const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const PNG = path.join(__dirname, 'proof.png');
const CLUB = '00000000-0000-0000-0000-00000000c001';

async function signIn(b, email, vp = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator(`input[value="${email}"]`) }).locator('button').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(600);
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();
  q(`update public.clubs set image_path = null where id='${CLUB}'`);

  // the club leader
  const layla = await signIn(b, 'demo.layla@pioneers.edu.ps');
  let p = layla.p;
  await p.goto(`${BASE}/clubs/${CLUB}/manage`, { waitUntil: 'networkidle' });
  check('The club leader sees the club picture field on the manage page', (await p.locator('[data-club-image-field]').count()) === 1);
  await p.locator('[data-club-image-input]').setInputFiles(PNG);
  await p.waitForFunction(() => document.querySelector('[data-club-image-field] img'), null, { timeout: 20000 });
  await p.waitForTimeout(800);
  const saved = q(`select image_path from public.clubs where id='${CLUB}'`);
  check('Uploading saves the picture for the club', /^[0-9a-f-]{36}\/00000000-0000-0000-0000-00000000c001\/.+\.(webp|jpg)$/.test(saved), saved);
  check('The manage page now shows the picture', (await p.locator('[data-club-image-field] img').evaluate((i) => i.complete && i.naturalWidth > 0)));
  await p.goto(BASE + '/clubs', { waitUntil: 'networkidle' });
  check('The club card on the list shows the picture', (await p.locator('[data-club="Robotics Club"] img').evaluate((i) => i.complete && i.naturalWidth > 0)));
  await p.goto(`${BASE}/clubs/${CLUB}`, { waitUntil: 'networkidle' });
  check('The club page header shows the picture', (await p.locator('main img[src*="club-images"], img[src*="/storage/"]').first().evaluate((i) => i.complete && i.naturalWidth > 0)));
  await layla.ctx.close();

  // a plain student sees it but cannot manage it
  const maya = await signIn(b, 'demo.maya@pioneers.edu.ps');
  await maya.p.goto(BASE + '/clubs', { waitUntil: 'networkidle' });
  check('Other students see the club picture', (await maya.p.locator('[data-club="Robotics Club"] img').count()) === 1);
  await maya.p.goto(`${BASE}/clubs/${CLUB}/manage`, { waitUntil: 'networkidle' });
  check('A plain member cannot open the manage page', !maya.p.url().includes('/manage'));

  // the admin account can change and remove it
  const rania = await signIn(b, 'demo.rania@pioneers.edu.ps');
  await rania.p.goto(`${BASE}/clubs/${CLUB}/manage`, { waitUntil: 'networkidle' });
  check('An admin can open the manage page and sees the picture field', (await rania.p.locator('[data-club-image-field]').count()) === 1);
  await rania.p.getByRole('button', { name: 'Remove' }).click(); await rania.p.waitForTimeout(1500);
  check('An admin can remove the club picture', q(`select image_path from public.clubs where id='${CLUB}'`) === '');
  await rania.ctx.close();

  // admin set-up page matches the student one
  const m2 = await signIn(b, 'demo.maya@pioneers.edu.ps');
  p = m2.p;
  await p.goto(BASE + '/apply-admin', { waitUntil: 'networkidle' });
  check('The admin set-up page has the brand side, the 3-step bar and the rounded card', (await p.locator('aside img[alt=Loop]').count()) === 1 && (await p.locator('ol[aria-label=Steps] li').count()) === 3 && (await p.locator('[data-step=profile]').count()) === 1);
  check('Step 1 shows the name and school email from Google, like the student set-up', /Maya Odeh/.test(await p.locator('#ad-name').inputValue()) && /From your Google account · demo\.maya@pioneers\.edu\.ps/.test(await p.locator('main').innerText()));
  await p.locator('[data-next]').click();
  check('Step 2 asks for the role and reasons', (await p.locator('[data-step=role]').count()) === 1 && (await p.getByRole('radio').count()) === 2);
  await p.getByRole('radio', { name: /Admin/ }).click();
  await p.locator('textarea[name=motivation]').fill('I want to help keep Loop safe and welcoming.');
  await p.locator('textarea[name=contribution]').fill('I will review reports quickly and help new students.');
  await p.getByRole('button', { name: 'Send application' }).click();
  await p.waitForSelector('[data-step=done]', { timeout: 15000 });
  check('Step 3 confirms the application was sent', /Application sent!/.test(await p.locator('[data-step=done]').innerText()) && q("select requested_role from public.admin_applications order by created_at desc limit 1") === 'admin');
  q("delete from public.admin_applications");
  const ph = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const pp = await ph.newPage();
  await pp.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await pp.locator('form', { has: pp.locator('input[value="demo.maya@pioneers.edu.ps"]') }).locator('button').click();
  await pp.waitForURL('**/home'); await pp.goto(BASE + '/apply-admin', { waitUntil: 'networkidle' });
  check('Phone: the admin set-up page fits the screen', (await pp.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - 390)) <= 0);
  await b.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
