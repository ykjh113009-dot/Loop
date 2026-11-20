const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const PNG = path.join(__dirname, 'proof.png');
const LAYLA = '00000000-0000-0000-0000-0000000000a3';

(async () => {
  const b = await chromium.launch();
  q(`update public.profiles set cover_path=null, photo_path=null where id='${LAYLA}'`);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator('input[value="demo.layla@pioneers.edu.ps"]') }).locator('button').click();
  await p.waitForURL('**/home'); await p.waitForTimeout(600);
  await p.goto(BASE + '/profile/edit', { waitUntil: 'networkidle' });

  const cover = p.locator('[data-testid=cover]');
  check('Everyone starts with the Loop logo cover', /default-cover\.webp/.test(await cover.evaluate((e) => getComputedStyle(e).backgroundImage)));
  await cover.hover(); await p.waitForTimeout(400);
  check('Hovering the cover shows a Change Cover button with a camera', await p.locator('[data-change-cover-label]').evaluate((e) => getComputedStyle(e).opacity) === '1' && /Change Cover/.test(await p.locator('[data-change-cover-label]').innerText()));
  check('The profile photo has a camera button', (await p.locator('[data-change-photo]').count()) === 1);

  // ---- cover modal
  await p.locator('[data-change-cover-area]').click({ force: true });
  await p.waitForSelector('[data-cover-modal]');
  check('Clicking the cover opens the Change Cover dialog with a preview', (await p.locator('[data-cover-preview]').count()) === 1 && (await p.getByRole('button', { name: /Upload a new cover/ }).count()) === 1 && (await p.locator('[data-restore-cover]').count()) === 1);
  await p.locator('[data-cover-input]').setInputFiles(PNG);
  await p.waitForSelector('[data-crop-image]');
  check('A new picture appears in the crop area with a zoom slider', (await p.locator('[data-zoom]').count()) === 1);
  await p.locator('[data-zoom]').fill('2');
  const frame = p.locator('[data-cover-modal] [tabindex="0"]');
  const box = await frame.boundingBox();
  await p.mouse.move(box.x + 100, box.y + 40); await p.mouse.down(); await p.mouse.move(box.x + 60, box.y + 20, { steps: 4 }); await p.mouse.up();
  check('The picture can be dragged to reposition it', (await p.locator('[data-crop-image]').evaluate((e) => e.style.transform)) !== '');
  await p.locator('[data-save-cover]').click();
  await p.waitForSelector('[data-cover-modal]', { state: 'detached', timeout: 20000 });
  await p.waitForTimeout(800);
  const saved = q(`select cover_path from public.profiles where id='${LAYLA}'`);
  check('Saving stores the cropped cover', /\.jpg$/.test(saved), saved);
  check('The banner now shows the new cover', !/default-cover/.test(await cover.evaluate((e) => getComputedStyle(e).backgroundImage)));
  await p.goto(`${BASE}/profile/${LAYLA}`, { waitUntil: 'networkidle' });
  check('The profile page shows the new cover too', !/default-cover/.test(await p.locator('[data-testid=cover]').evaluate((e) => getComputedStyle(e).backgroundImage)));
  await p.goto(BASE + '/profile/edit', { waitUntil: 'networkidle' });
  await p.locator('[data-change-cover-area]').click({ force: true }); await p.waitForSelector('[data-cover-modal]');
  await p.locator('[data-restore-cover]').click();
  check('Restore Default Cover previews the Loop logo cover', /default-cover/.test(await p.locator('[data-cover-preview]').getAttribute('src')));
  await p.locator('[data-save-cover]').click(); await p.waitForSelector('[data-cover-modal]', { state: 'detached', timeout: 20000 }); await p.waitForTimeout(800);
  check('Restoring saves the default (no custom cover)', q(`select coalesce(cover_path,'none') from public.profiles where id='${LAYLA}'`) === 'none');
  await p.locator('[data-change-cover-area]').click({ force: true }); await p.waitForSelector('[data-cover-modal]');
  await p.getByRole('button', { name: 'Cancel' }).click();
  check('Cancel closes the dialog', (await p.locator('[data-cover-modal]').count()) === 0);
  await p.locator('[data-change-cover-area]').click({ force: true }); await p.waitForSelector('[data-cover-modal]'); await p.keyboard.press('Escape');
  check('Escape closes the dialog', (await p.locator('[data-cover-modal]').count()) === 0);

  // ---- photo modal
  await p.locator('[data-change-photo]').click(); await p.waitForSelector('[data-photo-modal]');
  check('The photo dialog shows the current photo with Upload, Cancel and Save Photo', (await p.locator('[data-photo-preview]').count()) === 1 && (await p.getByRole('button', { name: /Upload New Photo/ }).count()) === 1 && (await p.locator('[data-save-photo]').count()) === 1);
  await p.locator('[data-photo-input]').setInputFiles(PNG);
  await p.waitForTimeout(400);
  check('A chosen photo previews before saving and offers Remove Photo', /^blob:/.test(await p.locator('[data-photo-preview]').getAttribute('src')) && (await p.locator('[data-remove-photo]').count()) === 1);
  await p.locator('[data-save-photo]').click(); await p.waitForSelector('[data-photo-modal]', { state: 'detached', timeout: 20000 }); await p.waitForTimeout(800);
  check('Save Photo stores the photo', /\.(webp|jpg)$/.test(q(`select coalesce(photo_path,'') from public.profiles where id='${LAYLA}'`)));
  await p.locator('[data-change-photo]').click(); await p.waitForSelector('[data-photo-modal]');
  await p.locator('[data-remove-photo]').click();
  await p.locator('[data-save-photo]').click(); await p.waitForSelector('[data-photo-modal]', { state: 'detached', timeout: 20000 }); await p.waitForTimeout(800);
  check('Remove Photo goes back to the avatar', q(`select coalesce(photo_path,'none') from public.profiles where id='${LAYLA}'`) === 'none');
  await p.locator('[data-change-photo]').click(); await p.waitForSelector('[data-photo-modal]');
  await p.getByRole('button', { name: 'or choose an avatar' }).click();
  await p.getByRole('radio', { name: /Avatar b05/ }).click();
  await p.locator('[data-save-photo]').click(); await p.waitForSelector('[data-photo-modal]', { state: 'detached', timeout: 20000 }); await p.waitForTimeout(800);
  check('Choosing an avatar in the dialog saves it', q(`select avatar from public.profiles where id='${LAYLA}'`) === 'b05');

  // ---- the page itself
  await p.reload({ waitUntil: 'networkidle' });
  const before = await p.locator('[data-interests] [aria-pressed=true]').count();
  const target = p.locator('[data-interests] button').filter({ hasText: 'Basketball' });
  await target.click();
  check('Selecting an interest turns it forest green with a checkmark', (await p.locator('[data-interests] [aria-pressed=true]').count()) === before + 1 && (await target.locator('svg').count()) === 1 && /bg-brand-700/.test(await target.getAttribute('class')));
  check('The interest counter updates', (await p.locator('[data-interest-count]').innerText()).trim() === `${before + 1}/10`);
  await p.locator('#ep-bio').fill('I enjoy robotics and chess.');
  check('The About you counter counts characters', /27 \/ 200/.test(await p.locator('[data-bio-count]').innerText()));
  check('The privacy reminder is shown', /Don't share your phone number/.test(await p.locator('[data-section=about]').innerText()));
  await p.locator('[data-save-changes]').click(); await p.waitForSelector('[data-saved]', { timeout: 15000 });
  check('Save changes stores the interests and About you', q(`select bio from public.profiles where id='${LAYLA}'`) === 'I enjoy robotics and chess.' && Number(q(`select count(*) from public.profile_interests where profile_id='${LAYLA}'`)) === before + 1);
  q(`update public.profiles set avatar='a09' where id='${LAYLA}'`);

  const ph = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const m = await ph.newPage();
  await m.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await m.locator('form', { has: m.locator('input[value="demo.layla@pioneers.edu.ps"]') }).locator('button').click();
  await m.waitForURL('**/home'); await m.goto(BASE + '/profile/edit', { waitUntil: 'networkidle' });
  check('Phone: the Change Cover button is always visible (no hover on touch)', await m.locator('[data-change-cover-label]').evaluate((e) => getComputedStyle(e).opacity) === '1');
  check('Phone: Edit Profile fits the screen', (await m.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - 390)) <= 0);
  await m.locator('[data-change-cover-area]').click({ force: true }); await m.waitForSelector('[data-cover-modal]');
  check('Phone: the cover dialog fits the screen', (await m.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - 390)) <= 0 && (await m.locator('[data-cover-modal] > div').last().evaluate((e) => e.getBoundingClientRect().width)) <= 390);
  await b.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
