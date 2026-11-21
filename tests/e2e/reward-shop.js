const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const MAYA = '00000000-0000-0000-0000-0000000000a5', SCHOOL = '00000000-0000-0000-0000-00000000a001';
const login = async (b, email, vp = { width: 1280, height: 900 }, mobile = false) => {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator(`input[value="${email}"]`) }).locator('button').click();
  await p.waitForURL('**/home');
  return { ctx, p };
};
const text = (p) => p.innerText('body');

(async () => {
  const b = await chromium.launch();
  q(`delete from public.reward_redemptions; delete from public.rewards where kind='prize'`);
  q(`insert into public.points_ledger (school_id, profile_id, points, reason, source_id) values ('${SCHOOL}','${MAYA}',300,'academic',gen_random_uuid())`);
  const rania = await login(b, 'demo.rania@pioneers.edu.ps');
  const maya = await login(b, 'demo.maya@pioneers.edu.ps');

  // Admin adds three rewards in different categories
  let p = rania.p;
  await p.goto(BASE + '/admin/rewards', { waitUntil: 'networkidle' });
  check('Admins see the reward tools and the Top 10 prizes', (await p.getByRole('button', { name: 'Add reward' }).count()) === 1 && (await p.locator('[data-place-row]').count()) === 10 && (await p.locator('[data-section=redemption-records]').count()) === 1);
  const add = async (name, cost, stock, cat) => {
    const f = p.locator('form', { has: p.getByRole('button', { name: 'Add reward' }) });
    await f.locator('input[name=name]').fill(name); await f.locator('input[name=description]').fill(name + ' for students');
    await f.locator('input[name=cost]').fill(String(cost)); await f.locator('input[name=stock]').fill(stock);
    await f.locator('select[name=category]').selectOption(cat);
    await f.getByRole('button', { name: 'Add reward' }).click();
    await p.waitForFunction((n) => document.body.innerText.includes(n), name, { timeout: 15000 });
  };
  await add('Cinema Tickets', 120, '2', 'experiences');
  await add('Wireless Headphones', 50000, '', 'technology');
  await add('Stationery Bundle', 40, '', 'study');
  check('Rewards are saved with their category', q(`select string_agg(category, ',' order by name) from public.rewards where name in ('Cinema Tickets','Wireless Headphones','Stationery Bundle')`) === 'experiences,study,technology');

  // Student: shop layout, filters, search
  p = maya.p;
  await p.goto(BASE + '/shop', { waitUntil: 'networkidle' });
  check('The shop has its banner, balance and search', (await p.locator('[data-shop-banner]').count()) === 1 && /Spend your Loop Points on exclusive rewards/.test(await text(p)) && (await p.locator('[data-testid=balance]').first().innerText()).length > 0 && (await p.locator('main input[name=q]').count()) === 1);
  const chipsText = (await p.locator('[data-shop-categories] a').allTextContents()).join('|');
  check('The category chips are All, Gift Cards, Technology, Study and Experiences', chipsText.startsWith('All|Gift Cards|Technology|Study|Experiences'), chipsText);
  check('The selected category is green', (await p.locator('[data-shop-categories] a[aria-current=page]').evaluate((e) => getComputedStyle(e).backgroundColor)) === 'rgb(70, 98, 55)');
  const names = async () => (await p.locator('[data-reward] h2:not([id])').allInnerTexts()).join('|');
  check('All rewards show in the grid', /Cinema Tickets/.test(await names()) && /Wireless Headphones/.test(await names()) && /Stationery Bundle/.test(await names()));
  await p.getByRole('link', { name: 'Technology' }).click(); await p.waitForURL('**cat=technology**');
  check('A category filters the rewards', (await names()) === 'Wireless Headphones', await names());
  await p.goto(BASE + '/shop?q=cinema', { waitUntil: 'networkidle' });
  check('Search finds a reward by name', (await names()) === 'Cinema Tickets', await names());
  await p.goto(BASE + '/shop', { waitUntil: 'networkidle' });
  check('Limited rewards carry an availability tag', /2 left/.test(await p.locator('[data-reward]', { hasText: 'Cinema Tickets' }).innerText()));

  // Not enough points
  const big = p.locator('[data-reward]', { hasText: 'Wireless Headphones' }).locator('[data-redeem]');
  check('Students cannot redeem without enough points', (await big.isDisabled()) && /Need .* more points/.test(await big.innerText()));

  // Redeem with a confirmation
  const balanceBefore = Number((await p.locator('[data-testid=balance]').first().innerText()).replace(/,/g, ''));
  await p.locator('[data-reward]', { hasText: 'Stationery Bundle' }).getByRole('button', { name: 'Redeem' }).click();
  const dlg = p.locator('[data-redeem-dialog][open]');
  check('Redeem opens a confirmation with the cost and the points left', (await dlg.count()) === 1 && /40 LP/.test(await dlg.innerText()) && (await dlg.locator('[data-after]').innerText()).replace(/,/g, '') === `${balanceBefore - 40} LP`);
  check('Nothing is spent before confirming', q(`select count(*) from public.reward_redemptions where profile_id='${MAYA}'`) === '0');
  await dlg.locator('[data-confirm-redeem]').click();
  await p.waitForFunction(() => /Done! Check your points/.test(document.body.innerText), null, { timeout: 15000 });
  check('Confirming creates a pending redemption record', q(`select status || '|' || cost from public.reward_redemptions where profile_id='${MAYA}'`) === 'pending|40');
  await p.goto(BASE + '/shop', { waitUntil: 'networkidle' });
  check('The balance drops by the cost', Number((await p.locator('[data-testid=balance]').first().innerText()).replace(/,/g, '')) === balanceBefore - 40);
  check('The status is shown under My rewards', /Waiting for staff/.test(await p.locator('[data-my-rewards]').innerText()));
  check('A reward at its per-student limit cannot be taken twice', await p.locator('[data-reward]', { hasText: 'Stationery Bundle' }).locator('[data-redeem]').isDisabled());
  const twice = q(`select count(*) from public.reward_redemptions where profile_id='${MAYA}'`);
  check('There is exactly one record', twice === '1');

  // Top 10
  check('The Top 10 banner and ten ranked slots are shown', (await p.locator('[data-top10-banner]').count()) === 1 && (await p.locator('[data-prize-slot]').count()) === 10 && /Top 10 Prizes/.test(await p.locator('[data-section=top10]').innerText()));
  const slots = await p.locator('[data-prize-slot]').evaluateAll((els) => els.map((e) => e.querySelector('p span')?.textContent));
  check('The ten starting prizes are in place', slots[0] === 'MacBook Air' && slots[1] === 'AirPods Pro' && slots[8] === 'SAT Refund' && slots[9] === 'Four Cinema Tickets', slots.join(' / '));
  check('The SAT refund is highlighted as an education reward', (await p.locator('[data-prize-slot="9"][data-special]').count()) === 1 && /Education reward/.test(await p.locator('[data-prize-slot="9"]').innerText()));
  check('The countdown shows for the monthly competition', /Monthly competition/.test(await p.locator('[data-top10-banner]').innerText()) && (await p.locator('[data-countdown]').count()) === 1);
  check('Students see no admin controls', (await p.locator('a[href="/admin/rewards"]').count()) === 0 && (await p.getByRole('button', { name: 'Add reward' }).count()) === 0);
  await p.goto(BASE + '/admin/rewards', { waitUntil: 'networkidle' });
  check('Students cannot use the admin reward page', /Only admins/.test(await text(p)) || !/Add reward/.test(await text(p)));

  // Admin hands it over; the student sees Ready
  p = rania.p;
  await p.goto(BASE + '/admin/rewards', { waitUntil: 'networkidle' });
  await p.locator('[data-redemption]').first().getByRole('button', { name: 'Handed over' }).click();
  await p.waitForFunction(() => !document.querySelector('[data-redemption]'), null, { timeout: 15000 });
  check('Staff can hand over a reward and it appears in the records', q(`select status from public.reward_redemptions where profile_id='${MAYA}'`) === 'fulfilled' && /Handed over/.test(await p.locator('[data-section=redemption-records]').innerText()));
  // Edit
  const row = p.locator('[data-reward-row]', { hasText: 'Cinema Tickets' });
  await row.locator('summary').click();
  await row.locator('input[name=cost]').fill('130');
  await row.getByRole('button', { name: 'Save changes' }).click();
  await p.waitForFunction(() => /130 LP/.test(document.body.innerText), null, { timeout: 15000 });
  check('An admin can edit a reward', q(`select cost from public.rewards where name='Cinema Tickets'`) === '130');
  await row.getByRole('button', { name: 'Hide from shop' }).click();
  await p.waitForFunction(() => /hidden/.test(document.body.innerText), null, { timeout: 15000 });
  check('An admin can hide a reward from the shop', q(`select active from public.rewards where name='Cinema Tickets'`) === 'f');
  // Top 10 prize edit with value and special
  const slot3 = p.locator('form[data-place="3"]');
  await slot3.locator('input[name=value]').fill('$100');
  await slot3.getByRole('button', { name: 'Save' }).click();
  await p.waitForFunction(() => /Saved/.test(document.body.innerText), null, { timeout: 15000 });
  check('An admin can set a prize value', q(`select value from public.top10_prizes where place=3`) === '$100');
  await p.locator('select[name=period]').selectOption('week');
  await p.getByRole('button', { name: 'Save rules' }).click();
  await p.waitForFunction(() => /Saved/.test(document.body.innerText), null, { timeout: 15000 });
  check('The competition period can be changed', q(`select period from public.top10_settings`) === 'week');
  q(`update public.top10_settings set period='month'`);

  // Phone
  const mobile = await login(b, 'demo.maya@pioneers.edu.ps', { width: 390, height: 844 }, true);
  await mobile.p.goto(BASE + '/shop', { waitUntil: 'networkidle' });
  check('No sideways scrolling on a phone', await mobile.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await mobile.p.goto(BASE + '/shop?view=top10', { waitUntil: 'networkidle' });
  const topBox = await mobile.p.locator('[data-section=top10]').boundingBox(); const shopBox = await mobile.p.locator('[data-section=reward-shop]').boundingBox();
  check('On a phone the Top 10 view lists the Top 10 first', topBox.y < shopBox.y);

  q(`delete from public.reward_redemptions; delete from public.rewards where kind='prize'`);
  await b.close();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
