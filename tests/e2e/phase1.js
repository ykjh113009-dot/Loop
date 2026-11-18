const { chromium } = require('playwright');
const crypto = require('crypto');
const { execSync } = require('child_process');
const BASE = 'http://localhost:3000';
const results = [];
const check = (name, ok, info = '') => { results.push([ok, name]); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();

// Authenticator-app code (TOTP, RFC 6238) from the base32 key.
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}

async function login(browser, name, viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('.lp-demo button', { hasText: name }).click();
  await p.waitForURL('**/home', { timeout: 20000 });
  return { ctx, p };
}
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

(async () => {
  const browser = await chromium.launch();

  // ---- Login page: Student / Admin choice
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
    const radios = await p.locator('.lp-kind [role=radio]').allInnerTexts();
    check('Login offers Student and Admin accounts', radios.join(',') === 'Student,Admin', radios.join(','));
    check('Student is chosen by default', await p.locator('.lp-kind [role=radio][aria-checked=true]').innerText() === 'Student');
    await p.locator('.lp-kind [role=radio]', { hasText: 'Admin' }).click();
    check('Choosing Admin explains the application step', /Super Admin reviews it/.test(await text(p)));
    check('Login still fits a phone with the new choice', await noSideScroll(p) && (await text(p)).includes('Your school. Your community.'));
    await ctx.close();
  }

  // ---- Student: no admin access, can apply
  const maya = await login(browser, 'Maya Odeh');
  {
    const p = maya.p;
    for (const r of ['/admin', '/admin/applications', '/admin/leadership', '/admin/log', '/admin/settings', '/moderation']) {
      await p.goto(BASE + r, { waitUntil: 'networkidle' });
      if (!p.url().endsWith('/home')) { check('Student is kept out of ' + r, false, p.url()); }
    }
    check('A student is sent home from every admin page', results.every((r) => r[0]));
    await p.goto(BASE + '/apply-admin', { waitUntil: 'networkidle' });
    check('Application form shows the verified name and school email', await p.locator('input[readonly]').nth(0).inputValue() === 'Maya Odeh' && /demo\.maya@pioneers\.edu\.ps/.test(await p.locator('main').innerText()));
    await p.fill('#ad-position', 'Grade 9 student');
    await p.locator('[data-next]').click();
    await p.getByRole('radio', { name: /Admin/ }).click();
    await p.fill('textarea[name=motivation]', 'I want to help keep Loop a friendly place for everyone.');
    await p.fill('textarea[name=contribution]', 'I will check reports every day and help plan events.');
    await p.fill('textarea[name=experience]', 'Class representative in grade 8.');
    await p.getByRole('button', { name: 'Send application' }).click();
    await p.waitForFunction(() => /Waiting for review/.test(document.body.innerText), null, { timeout: 15000 });
    check('Student can send an admin application', /waiting for review/i.test(await text(p)));
    check('Applying gives no permissions', sql(`select role from public.profiles where id='00000000-0000-0000-0000-0000000000a5'`) === 'student');
    await p.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    check('Applicant still cannot open the admin dashboard', p.url().endsWith('/home'));
  }

  // ---- Student asks for a leadership role
  const layla = await login(browser, 'Layla Nasser');
  {
    const p = layla.p;
    await p.goto(BASE + '/leadership', { waitUntil: 'networkidle' });
    check('Existing club leaders already show their leadership role', /Club leader/.test(await p.locator('section').first().innerText()), (await p.locator('section').first().innerText()).slice(0, 80));
    await p.selectOption('select[name=kind]', 'class_rep');
    await p.fill('input[name=scope]', '10a');
    await p.fill('textarea[name=reason]', 'I want to represent class 10A this year.');
    await p.getByRole('button', { name: 'Send request' }).click();
    await p.waitForFunction(() => /Waiting for review/.test(document.body.innerText), null, { timeout: 15000 });
    check('Student can ask for a leadership role', /Class representative · 10A/.test(await text(p)));
  }

  // ---- Moderator: moderation yes, admin no, no suspend
  {
    const { ctx, p } = await login(browser, 'Omar Khalil');
    await p.goto(BASE + '/moderation', { waitUntil: 'networkidle' });
    check('Moderator can open moderation', p.url().endsWith('/moderation'));
    check('Moderator sees no suspend option', (await p.locator('summary', { hasText: 'Suspend' }).count()) === 0);
    await p.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    check('Moderator cannot open the admin dashboard', p.url().endsWith('/home'));
    await ctx.close();
  }

  // ---- Super Admin (owner)
  const rania = await login(browser, 'Rania Haddad');
  {
    const p = rania.p;
    await p.goto(BASE + '/admin/applications', { waitUntil: 'networkidle' });
    const card = p.locator('article', { hasText: 'Maya Odeh' });
    check('Super Admin sees the application with all answers', /Grade 9 student/.test(await card.innerText()) && /friendly place/.test(await card.innerText()) && /Class representative in grade 8/.test(await card.innerText()) && /demo\.maya@pioneers\.edu\.ps/.test(await card.innerText()));
    await card.locator('select[name=role]').selectOption('moderator');
    await card.locator('input[name=note]').fill('Start as a moderator first.');
    await card.getByRole('button', { name: 'Approve' }).click();
    await p.waitForFunction(() => /Approved as Moderator/.test(document.body.innerText), null, { timeout: 15000 });
    check('Super Admin can approve with a different role than requested', sql(`select role from public.profiles where id='00000000-0000-0000-0000-0000000000a5'`) === 'moderator');

    await p.goto(BASE + '/admin/leadership', { waitUntil: 'networkidle' });
    const req = p.locator('article', { hasText: 'Layla Nasser' });
    await req.getByRole('button', { name: 'Approve' }).click();
    await p.waitForFunction(() => !document.querySelector('article'), null, { timeout: 15000 });
    check('Leadership request approved', sql(`select count(*) from public.leadership_roles where kind='class_rep' and scope='10A'`) === '1');
    const row = p.locator('li', { hasText: 'Class representative · 10A' });
    await row.getByRole('button', { name: 'Remove' }).click();
    await p.waitForFunction(() => !/Class representative · 10A/.test(document.body.innerText), null, { timeout: 15000 });
    check('Super Admin can remove an assigned leadership role', sql(`select count(*) from public.leadership_roles where kind='class_rep'`) === '0');

    // account page: roles, restrictions, suspension choices
    await p.goto(BASE + '/admin/students/00000000-0000-0000-0000-0000000000a4', { waitUntil: 'networkidle' });
    const roleOptions = await p.locator('select[name=role] option').allInnerTexts();
    check('Owner can choose every role including Super Admin', roleOptions.includes('Super Admin') && !(await p.locator('select[name=role]').isDisabled()), roleOptions.join(','));
    const dayOptions = await p.locator('select[name=days] option').allInnerTexts();
    check('Suspension choices are 1, 3, 7, 30 days or custom (no permanent)', dayOptions.join('|') === '1 day|3 days|7 days|30 days|Custom…', dayOptions.join('|'));
    const pause = p.locator('section', { hasText: 'Paused activities' });
    await pause.locator('select[name=kind]').selectOption('posting');
    await pause.locator('input[name=reason]').fill('Too many off-topic posts');
    await pause.getByRole('button', { name: 'Pause' }).click();
    await p.waitForFunction(() => /Posting paused until/.test(document.body.innerText), null, { timeout: 15000 });
    check('Admin can pause posting for a student', sql(`select count(*) from public.account_restrictions where kind='posting'`) === '1');
    await p.selectOption('select[name=role]', 'admin');
    await p.locator('section', { hasText: 'Grade and role' }).getByRole('button', { name: 'Save' }).click();
    await p.waitForFunction(() => /Saved/.test(document.body.innerText), null, { timeout: 15000 });
    check('Super Admin can make someone an Admin', sql(`select role from public.profiles where id='00000000-0000-0000-0000-0000000000a4'`) === 'admin');

    await p.goto(BASE + '/admin/log', { waitUntil: 'networkidle' });
    const log = await text(p);
    check('Activity log lists the actions just taken', /approve admin application/.test(log) && /approve leadership/.test(log) && /remove leadership/.test(log) && /restrict/.test(log) && /change role/.test(log));
    await p.goto(BASE + '/admin/settings', { waitUntil: 'networkidle' });
    check('Super Admin sees school settings', await p.locator('input[name=grades]').count() === 1);
  }

  // ---- The restricted student cannot post; the new Admin has limits
  {
    const { ctx, p } = await login(browser, 'Yousef Saleh');
    await p.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    check('New Admin can open the admin dashboard', p.url().endsWith('/admin'));
    await p.goto(BASE + '/admin/applications', { waitUntil: 'networkidle' });
    check('Admin is told applications are for Super Admins only', /Only Super Admins/.test(await text(p)));
    await p.goto(BASE + '/admin/settings', { waitUntil: 'networkidle' });
    check('Admin cannot change school settings', await p.locator('input[name=grades]').count() === 0 && /only be changed by a Super Admin/.test(await text(p)));
    await p.goto(BASE + '/admin/students/00000000-0000-0000-0000-0000000000a3', { waitUntil: 'networkidle' });
    check('Admin cannot change roles', await p.locator('select[name=role]').isDisabled());
    await p.goto(BASE + '/admin/students/00000000-0000-0000-0000-0000000000a1', { waitUntil: 'networkidle' });
    check('Admin gets no controls over the owner account', (await p.locator('section', { hasText: 'Suspension' }).count()) === 0 && (await p.locator('section', { hasText: 'Remove account' }).count()) === 0);
    await p.goto(BASE + '/admin/leadership', { waitUntil: 'networkidle' });
    check('Admin can open leadership but sees no Remove button', p.url().endsWith('/admin/leadership') && (await p.getByRole('button', { name: 'Remove' }).count()) === 0);
    await ctx.close();
  }

  // ---- Two-step sign-in
  {
    const p = rania.p;
    await p.goto(BASE + '/security', { waitUntil: 'networkidle' });
    check('Security page explains passwords are never visible', /never sees or stores your password/.test(await text(p)));
    await p.getByRole('button', { name: 'Set up two-step sign-in' }).click();
    await p.waitForSelector('img[alt^="QR code"]', { timeout: 15000 });
    const secret = (await p.locator('span.font-mono').innerText()).trim();
    await p.fill('input[autocomplete=one-time-code]', '000000');
    await p.getByRole('button', { name: 'Turn on' }).click();
    await p.waitForSelector('.card [role=alert]', { timeout: 15000 });
    check('A wrong code is refused', /not right/.test(await p.locator('.card [role=alert]').innerText()));
    await p.fill('input[autocomplete=one-time-code]', totp(secret));
    await p.getByRole('button', { name: 'Turn on' }).click();
    await p.waitForFunction(() => /Two-step sign-in is on/.test(document.body.innerText), null, { timeout: 15000 });
    check('Two-step sign-in can be turned on with an authenticator code', sql(`select count(*) from auth.mfa_factors where status='verified'`) === '1');

    // Now the school requires it (as on the real site).
    sql(`update public.schools set admin_mfa_required = true`);
    await p.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    check('After the second step the admin dashboard opens', p.url().endsWith('/admin'));

    // A fresh sign-in has only passed step one.
    const again = await login(browser, 'Rania Haddad');
    await again.p.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    check('A new sign-in is stopped before the admin dashboard', /\/security\?verify=1$/.test(again.p.url()), again.p.url());
    await again.p.goto(BASE + '/moderation', { waitUntil: 'networkidle' });
    check('...and before moderation', /\/security/.test(again.p.url()));
    // wait for a fresh 30-second window so the code was not used already
    await new Promise((r) => setTimeout(r, 31000));
    await again.p.goto(BASE + '/security?verify=1', { waitUntil: 'networkidle' });
    await again.p.fill('input[autocomplete=one-time-code]', totp(secret));
    await again.p.getByRole('button', { name: 'Verify' }).click();
    await again.p.waitForFunction(() => /Admin tools are unlocked/.test(document.body.innerText), null, { timeout: 15000 });
    await again.p.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    check('Entering the code unlocks the admin tools', again.p.url().endsWith('/admin'));
    await again.p.goto(BASE + '/security', { waitUntil: 'networkidle' });
    check('Security page lists recent activity', /Two-step sign-in passed/.test(await text(again.p)));
    await again.ctx.close();

    // An admin with no authenticator yet is asked to set one up.
    const y = await login(browser, 'Yousef Saleh');
    await y.p.goto(BASE + '/admin', { waitUntil: 'networkidle' });
    check('An admin without an authenticator is sent to set it up', /\/security/.test(y.p.url()) && /Required for admins/.test(await text(y.p)) && (await y.p.getByRole('button', { name: 'Set up two-step sign-in' }).count()) === 1);
    await y.ctx.close();
    sql(`update public.schools set admin_mfa_required = false`);
  }

  // ---- Phone layouts of the new pages
  {
    const { ctx, p } = await login(browser, 'Rania Haddad', { width: 375, height: 740 });
    const bad = [];
    for (const r of ['/admin', '/admin/applications', '/admin/leadership', '/admin/log', '/admin/settings', '/admin/students/00000000-0000-0000-0000-0000000000a4', '/security', '/leadership', '/apply-admin', '/more']) {
      await p.goto(BASE + r, { waitUntil: 'networkidle' });
      if (!(await noSideScroll(p))) bad.push(r);
    }
    check('New pages fit a 375px phone without sideways scrolling', bad.length === 0, bad.join(', '));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r[0]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
