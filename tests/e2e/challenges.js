const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const BASE = 'http://localhost:3000';
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();
const ID = { rania: '00000000-0000-0000-0000-0000000000a1', yousef: '00000000-0000-0000-0000-0000000000a4', maya: '00000000-0000-0000-0000-0000000000a5' };
const go = (p, path) => p.goto(BASE + path, { waitUntil: 'networkidle' });
const waitText = (p, re, t = 20000) => p.waitForFunction((s) => new RegExp(s).test(document.body.innerText), re.source, { timeout: t });
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const PROOF = require('path').join(__dirname, 'proof.png'); // a small real picture, made by the test setup

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
  sql(`delete from public.rate_events where profile_id in ('${ID.maya}','${ID.yousef}','${ID.rania}'); delete from public.challenges where title like 'E2E %'; delete from public.points_ledger where profile_id in ('${ID.maya}','${ID.yousef}') and reason like 'challenge%';`);
  const rania = await login(browser, 'Rania Haddad');
  const maya = await login(browser, 'Maya Odeh');
  const yousef = await login(browser, 'Yousef Saleh');
  const mobile = await login(browser, 'Maya Odeh', { width: 390, height: 800 });

  // 1. A student creates a challenge and sends it for review
  let id;
  {
    const p = yousef.p;
    await go(p, '/challenges');
    check('Challenges page shows the four tabs', /Discover/.test(await text(p)) && /Joined/.test(await text(p)) && /Completed/.test(await text(p)) && /My ideas/.test(await text(p)));
    await p.getByRole('link', { name: /New/ }).first().click();
    await p.waitForURL('**/challenges/new');
    await p.fill('input[name=title]', 'E2E Photo hunt');
    await p.fill('textarea[name=description]', 'Find the old tree behind the library and take a photo next to it.');
    await p.fill('textarea[name=instructions]', 'Walk to the tree and photograph it. Do not climb it.');
    await p.fill('input[name=points]', '30');
    await p.getByRole('button', { name: /Send for review/ }).click();
    await waitText(p, /Please confirm the challenge is safe/);
    check('The safety confirmation is required, and nothing typed is lost', p.url().includes('/challenges/new') && (await p.inputValue('input[name=title]')) === 'E2E Photo hunt');
    await p.check('input[name=safe]');
    await p.getByRole('button', { name: /Send for review/ }).click();
    await p.waitForURL(/\/challenges\/[0-9a-f-]{36}$/, { timeout: 20000 });
    id = p.url().split('/').pop();
    await waitText(p, /Pending review/);
    check('The challenge is waiting for review', /Pending review/.test(await text(p)) && sql(`select status from public.challenges where id='${id}'`) === 'pending');
  }

  // 2. Other students cannot see it yet
  {
    const p = maya.p;
    await go(p, '/challenges');
    check('A pending challenge is not listed for other students', !/E2E Photo hunt/.test(await text(p)));
    const r = await p.goto(BASE + `/challenges/${id}`);
    check('A pending challenge cannot be opened by other students', r.status() === 404 || /couldn.t find/i.test(await text(p)));
  }

  // 3. The Council / admin approves it
  {
    const p = rania.p;
    await go(p, '/challenges/review');
    check('The review page lists the idea with its details', /E2E Photo hunt/.test(await text(p)) && /\+30 points/.test(await text(p)));
    const card = p.locator('article', { hasText: 'E2E Photo hunt' });
    await card.getByRole('button', { name: 'Approve' }).click();
    await waitText(p, /Confirm the challenge is safe|safe, private/i, 8000).catch(() => {});
    await card.locator('input[name=safe]').check();
    await card.getByRole('button', { name: 'Approve' }).click();
    await p.waitForFunction((t) => !document.body.innerText.includes(t), 'E2E Photo hunt', { timeout: 15000 });
    check('An admin can approve a challenge idea', sql(`select status from public.challenges where id='${id}'`) === 'approved');
  }

  // 4. A student finds it, joins and sends proof
  {
    const p = maya.p;
    await go(p, '/challenges');
    check('The approved challenge appears in Discover', /E2E Photo hunt/.test(await text(p)));
    await p.getByRole('link', { name: /E2E Photo hunt/ }).click();
    await p.waitForURL(`**/challenges/${id}`);
    await waitText(p, /What you need to send/);
    check('The detail page shows reward, deadline and what to send', /\+30 points/.test(await text(p)) && /Deadline/.test(await text(p)) && /What you need to send/.test(await text(p)));
    await p.getByRole('button', { name: 'Join this challenge' }).click();
    await waitText(p, /Send your proof/).catch(async () => { console.log('JOIN PAGE:', (await text(p)).slice(-400)); throw new Error('join failed'); });
    await p.setInputFiles('input[type=file]', PROOF);
    await waitText(p, /proof\.png/, 20000);
    await p.fill('textarea[name=note]', 'Here I am next to the old tree!');
    await p.getByRole('button', { name: 'Send my proof' }).click();
    await waitText(p, /Submitted/);
    check('Proof is sent and shown as "Submitted"', sql(`select count(*) from public.challenge_submissions where challenge_id='${id}' and status='submitted'`) === '1');
    check('The proof file is stored in the private bucket', sql(`select count(*) from storage.objects where bucket_id='challenge-proof'`) >= '1');
  }

  // 5. The creator checks it
  {
    const p = yousef.p;
    await go(p, `/challenges/${id}/manage`);
    check('The creator sees the entry and the proof photo', /Maya Odeh/.test(await text(p)) && (await p.locator('article img').count()) === 1);
    await p.getByRole('button', { name: 'Start checking' }).click();
    await waitText(p, /Pending verification/);
    await p.getByRole('button', { name: 'Reject' }).click();
    await waitText(p, /Tell the student why/);
    check('Rejecting needs feedback', true);
    await p.fill('input[name=note]', 'Great photo, well done!');
    await p.getByRole('button', { name: 'Approve' }).click();
    await waitText(p, /Approved/);
    check('Approving pays the fixed reward once', sql(`select coalesce(sum(points),0) from public.points_ledger where profile_id='${ID.maya}' and reason='challenge'`) === '30');
  }

  // 6. The student sees the result
  {
    const p = maya.p;
    await go(p, `/challenges/${id}`);
    check('The student sees "Approved" and the points', /Approved/.test(await text(p)) && /\+30 points/.test(await text(p)));
    await go(p, '/challenges?tab=done');
    check('The challenge is in Completed and the total is shown', /E2E Photo hunt/.test(await text(p)) && /earned\s*30\s*points/.test(await text(p)));
    await go(p, '/points');
    check('The points page lists the challenge', /Challenge/.test(await text(p)));
  }

  // 7. Privacy and permissions
  {
    const p = maya.p;
    await go(p, `/challenges/${id}/manage`);
    check('A normal student cannot open the manage page', !/Waiting to be checked/.test(await text(p)));
    await go(p, '/challenges/review');
    check('A normal student cannot open the review page', !/Warning signs/.test(await text(p)));
  }

  // 8. Phones
  {
    const p = mobile.p;
    for (const path of ['/challenges', '/challenges/new', `/challenges/${id}`]) {
      await go(p, path);
      check(`No sideways scrolling on a phone: ${path.replace(id, ':id')}`, await noSideScroll(p));
    }
  }
  await go(yousef.p, `/challenges/${id}/manage`);
  check('No sideways scrolling on the manage page (desktop)', await noSideScroll(yousef.p));

  sql(`delete from public.challenges where title like 'E2E %'; delete from public.points_ledger where profile_id in ('${ID.maya}','${ID.yousef}') and reason like 'challenge%';`);
  await browser.close();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
