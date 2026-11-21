const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const PIC = path.join(__dirname, 'proof.png');
const login = async (b, email, vp = { width: 1280, height: 900 }, mobile = false) => {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator(`input[value="${email}"]`) }).locator('button').click();
  await p.waitForURL('**/home');
  return { ctx, p };
};
const go = (p, u) => p.goto(BASE + u, { waitUntil: 'networkidle' });
const openDetails = async (p, title) => {
  await go(p, '/market');
  await p.locator('[data-listing]', { hasText: title }).first().locator('a[data-details]').last().click();
  await p.locator('[data-details-dialog][open] [data-listing-title]').waitFor({ timeout: 15000 });
  return p.locator('[data-details-dialog][open]');
};

(async () => {
  const b = await chromium.launch();
  const maya = await login(b, 'demo.maya@pioneers.edu.ps');
  let p = maya.p;

  // Maya posts an item with three pictures and a place to meet
  await go(p, '/market/new');
  await p.fill('input[name=title]', 'E2E Gaming Headset');
  await p.fill('textarea[name=description]', 'Barely used, comes with the box.');
  await p.fill('input[name=price]', '100');
  await p.fill('input[name=location]', 'School gate');
  await p.locator('[data-multi-photo-input]').setInputFiles([PIC, PIC, PIC]);
  await p.waitForFunction(() => document.querySelectorAll('input[name=image_path]').length === 3, null, { timeout: 30000 });
  await p.getByRole('button', { name: 'Post item' }).click();
  await p.waitForURL(/\/market\/[0-9a-f-]{36}$/, { timeout: 20000 });
  const id = p.url().split('/').pop();
  check('A listing can have up to four pictures and a meeting place', q(`select count(*) from public.listing_images where listing_id='${id}'`) === '3' && q(`select location from public.listings where id='${id}'`) === 'School gate');
  check('The first picture is also the cover', q(`select (image_path = (select path from public.listing_images where listing_id='${id}' order by sort limit 1))::text from public.listings where id='${id}'`) === 'true');
  await p.locator('[data-listing-details]').waitFor({ timeout: 15000 });
  check('The listing page uses the same details view', (await p.locator('[data-listing-details]').count()) === 1 && (await p.locator('[data-gallery]').count()) === 1);

  // Layla opens the details popup
  const layla = await login(b, 'demo.layla@pioneers.edu.ps');
  p = layla.p;
  let dlg = await openDetails(p, 'E2E Gaming Headset');
  const txt = await dlg.innerText();
  check('The popup shows title, price, condition, description, seller, grade, time and place', /E2E Gaming Headset/.test(txt) && /₪100/.test(txt) && /Good/.test(txt) && /Barely used/.test(txt) && /Maya Odeh/.test(txt) && /Grade 9/.test(txt) && /School gate/.test(txt) && /ago|now|min|h/.test(txt));
  check('The seller name links to the profile', (await dlg.locator('[data-seller-link]').getAttribute('href')) === '/profile/00000000-0000-0000-0000-0000000000a5');
  check('The page behind cannot scroll while the popup is open', (await p.evaluate(() => document.body.style.overflow)) === 'hidden');
  check('The gallery shows a counter and three thumbnails', /1 \/ 3/.test(await dlg.locator('[data-gallery-counter]').innerText()) && (await dlg.locator('[data-gallery-thumbs] button').count()) === 3);
  await dlg.getByRole('button', { name: 'Next picture' }).click();
  await p.waitForFunction(() => /2 \/ 3/.test(document.querySelector('[data-details-dialog][open] [data-gallery-counter]').textContent));
  check('The arrow moves to the next picture', true);
  await dlg.locator('[data-gallery-thumbs] button').nth(2).click();
  await p.waitForFunction(() => /3 \/ 3/.test(document.querySelector('[data-details-dialog][open] [data-gallery-counter]').textContent));
  check('A thumbnail jumps to its picture', true);
  await dlg.getByRole('button', { name: 'Previous picture' }).click();
  await p.waitForFunction(() => /2 \/ 3/.test(document.querySelector('[data-details-dialog][open] [data-gallery-counter]').textContent));
  check('The previous arrow goes back', true);

  // Save and unsave
  await dlg.locator('[data-save-item]').click();
  await p.waitForFunction(() => /Saved/.test(document.querySelector('[data-details-dialog][open] [data-save-item]').textContent));
  check('Save Item stores the saved item', q(`select count(*) from public.listing_saves where listing_id='${id}'`) === '1');
  await p.keyboard.press('Escape');
  check('Escape closes the popup and unlocks the page', (await p.locator('[data-details-dialog][open]').count()) === 0 && (await p.evaluate(() => document.body.style.overflow)) === '');
  dlg = await openDetails(p, 'E2E Gaming Headset');
  check('Reopening shows the item as saved', /Saved/.test(await dlg.locator('[data-save-item]').innerText()));
  await dlg.locator('[data-save-item]').click();
  await p.waitForFunction(() => /Save Item/.test(document.querySelector('[data-details-dialog][open] [data-save-item]').textContent));
  check('Tapping again unsaves it', q(`select count(*) from public.listing_saves where listing_id='${id}'`) === '0');

  // Offers
  await dlg.locator('[data-make-offer]').click();
  const sheet = p.locator('[data-offer-sheet][open]');
  check('Make an Offer opens a window with the asking price', (await sheet.count()) === 1 && /₪100/.test(await sheet.innerText()));
  await sheet.locator('[data-offer-amount]').fill('150');
  await sheet.locator('input[data-offer-amount]').evaluate((e) => e.removeAttribute('max'));
  await sheet.getByRole('button', { name: 'Send offer' }).click();
  await p.waitForFunction(() => /cannot be higher/.test(document.querySelector('[data-offer-sheet][open]').textContent), null, { timeout: 15000 });
  check('An offer above the asking price is refused', q(`select count(*) from public.listing_offers where listing_id='${id}'`) === '0');
  await sheet.locator('[data-offer-amount]').fill('80');
  await sheet.locator('textarea').fill('Can you do 80?');
  await sheet.getByRole('button', { name: 'Send offer' }).click();
  await p.waitForFunction(() => /Offer sent/.test(document.querySelector('[data-offer-sheet][open]').textContent), null, { timeout: 15000 });
  check('An offer is saved and the seller is notified', q(`select amount || '|' || status || '|' || message from public.listing_offers where listing_id='${id}'`) === '80.00|pending|Can you do 80?' && q(`select count(*) from public.notifications where recipient_id='00000000-0000-0000-0000-0000000000a5' and kind='listing_offer'`) === '1');
  await sheet.getByRole('button', { name: 'Close' }).last().click();
  await p.waitForFunction(() => document.querySelector('[data-details-dialog][open] [data-my-offer]'), null, { timeout: 15000 });
  check('The buyer sees their pending offer', /₪80/.test(await p.locator('[data-details-dialog][open] [data-my-offer]').innerText()));
  await p.locator('[data-details-dialog][open] [data-my-offer] button', { hasText: 'Change' }).click();
  await p.locator('[data-offer-sheet][open] [data-offer-amount]').fill('90');
  await p.locator('[data-offer-sheet][open]').getByRole('button', { name: 'Send offer' }).click();
  await p.waitForFunction(() => /Offer sent/.test(document.querySelector('[data-offer-sheet][open]').textContent), null, { timeout: 15000 });
  check('Changing the offer keeps a single open offer', q(`select count(*) || '|' || max(amount) from public.listing_offers where listing_id='${id}' and status='pending'`) === '1|90.00');
  await p.locator('[data-offer-sheet][open]').getByRole('button', { name: 'Close' }).last().click();

  // Message the seller (one conversation, however often)
  await p.keyboard.press('Escape');
  dlg = await openDetails(p, 'E2E Gaming Headset');
  await dlg.locator('[data-listing-details] form button', { hasText: 'Message Seller' }).first().click();
  await p.waitForURL('**/messages/**', { timeout: 15000 });
  const chatUrl = p.url();
  dlg = await openDetails(p, 'E2E Gaming Headset');
  await dlg.locator('[data-listing-details] form button', { hasText: 'Message Seller' }).first().click();
  await p.waitForURL('**/messages/**', { timeout: 15000 });
  check('Message Seller opens the same conversation each time', p.url() === chatUrl);

  // Report
  dlg = await openDetails(p, 'E2E Gaming Headset');
  await dlg.getByRole('button', { name: /Report Listing/ }).click();
  await p.locator('dialog[open] select[name=reason], dialog[open] input[name=reason]').first().waitFor();
  const reason = p.locator('dialog[open] select[name=reason]');
  if (await reason.count()) await reason.selectOption('spam'); else await p.locator('dialog[open] input[name=reason][value=spam]').check();
  await p.locator('dialog[open]').last().getByRole('button', { name: /send|report|submit/i }).last().click();
  await p.waitForFunction(() => /Thank you|already reported/.test(document.body.innerText), null, { timeout: 15000 });
  check('Report Listing uses the existing reports', q(`select count(*) from public.reports where target_type='listing' and target_id='${id}'`) === '1');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');

  // A seller deals with offers
  p = maya.p;
  await go(p, '/market');
  await p.locator('[data-listing]', { hasText: 'E2E Gaming Headset' }).first().locator('a[data-details]').last().click();
  await p.locator('[data-details-dialog][open] [data-owner-offers]').waitFor({ timeout: 15000 });
  check('The seller sees the offers on their own item, not buy buttons', /₪90/.test(await p.locator('[data-details-dialog][open] [data-owner-offers]').innerText()) && (await p.locator('[data-details-dialog][open] [data-make-offer]').count()) === 0);
  await p.locator('[data-details-dialog][open] [data-accept-offer]').click();
  await p.waitForFunction(() => /accepted/i.test(document.querySelector('[data-details-dialog][open] [data-owner-offers]').textContent), null, { timeout: 15000 });
  check('Accepting an offer reserves the item and tells the buyer', q(`select status from public.listings where id='${id}'`) === 'reserved' && q(`select status from public.listing_offers where listing_id='${id}'`) === 'accepted' && q(`select count(*) from public.notifications where recipient_id='00000000-0000-0000-0000-0000000000a3' and kind='listing_offer'`) === '1');

  // Items that cannot take offers or have no pictures
  p = layla.p;
  dlg = await openDetails(p, 'School uniform shirts');
  check('A free item has no Make an Offer button and no gallery arrows', (await dlg.locator('[data-make-offer]').count()) === 0 && (await dlg.locator('[data-gallery-empty]').count()) === 1 && (await dlg.getByRole('button', { name: 'Next picture' }).count()) === 0);
  await p.keyboard.press('Escape');

  // Phone: full screen, swipe, dots, sticky bar
  const mob = await login(b, 'demo.layla@pioneers.edu.ps', { width: 390, height: 844 }, true);
  p = mob.p;
  await go(p, '/market');
  await p.locator('[data-listing]', { hasText: 'E2E Gaming Headset' }).first().locator('a[data-details]').last().click();
  await p.locator('[data-details-dialog][open] [data-listing-title]').waitFor({ timeout: 15000 });
  const box = await p.locator('[data-details-dialog][open]').boundingBox();
  check('On a phone the details fill the whole screen', box.width >= 388 && box.height >= 840, JSON.stringify(box));
  check('On a phone there are dots, not thumbnails, and a Back button', (await p.locator('[data-details-dialog][open] [data-gallery-dots]').isVisible()) && !(await p.locator('[data-details-dialog][open] [data-gallery-thumbs]').isVisible()) && (await p.getByRole('button', { name: 'Back' }).isVisible()));
  await p.locator('[data-details-dialog][open] [data-gallery] [aria-roledescription=carousel]').evaluate((el) => el.scrollTo({ left: el.clientWidth * 2, behavior: 'instant' }));
  await p.waitForFunction(() => /3 \/ 3/.test(document.querySelector('[data-details-dialog][open] [data-gallery-counter]').textContent));
  check('Swiping moves through the pictures and the counter follows', true);
  check('The main action stays in a bar at the bottom', await p.locator('[data-details-dialog][open] [data-mobile-actions]').isVisible());
  check('Nothing overflows sideways', await p.evaluate(() => { const d = document.querySelector('[data-details-dialog][open]'); return d.scrollWidth <= d.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
  await p.getByRole('button', { name: 'Back' }).click();
  check('Back closes the details', (await p.locator('[data-details-dialog][open]').count()) === 0);
  await b.close();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
