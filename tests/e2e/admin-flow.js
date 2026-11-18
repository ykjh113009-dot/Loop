const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const LAYLA = '00000000-0000-0000-0000-0000000000a3';

(async () => {
  const b = await chromium.launch();
  q(`update public.profiles set onboarded_at = null where id='${LAYLA}'`);
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator('input[value="demo.layla@pioneers.edu.ps"]') }).locator('button').click();
  await p.waitForURL('**/welcome', { timeout: 30000 }); await p.waitForSelector('[data-step=profile]', { timeout: 15000 });
  check('A new person without a profile sees the same set-up screen first', /Let's set up your profile!/.test(await p.locator('body').innerText()));
  await p.goto(BASE + '/apply-admin', { waitUntil: 'networkidle' }); await p.waitForSelector('[data-step=profile]', { timeout: 15000 });
  check('Choosing Admin sends a new person through the same profile set-up first', p.url().includes('/welcome') && p.url().includes('next=apply-admin'), p.url());
  check('It is the same screen as the student one', /Let's set up your profile!/.test(await p.locator('body').innerText()) && (await p.locator('ol[aria-label=Steps] li').count()) === 3);
  q(`update public.profiles set onboarded_at = now() where id='${LAYLA}'`);
  await p.goto(BASE + '/welcome?next=apply-admin', { waitUntil: 'networkidle' }); await p.waitForSelector('[data-step=profile]', { timeout: 15000 });
  check('Once the profile is done, the flow continues to the admin application', p.url().endsWith('/apply-admin'), p.url());
  check('The application step has the same look', (await p.locator('ol[aria-label=Steps] li').count()) === 3 && /set up your admin account/.test(await p.locator('body').innerText()));
  await b.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
