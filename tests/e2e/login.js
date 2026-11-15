const { chromium } = require('playwright');
const { createRequire } = require('module');
const req = createRequire('/home/user/pbs-go/package.json');
const { createClient } = req('@supabase/supabase-js');
const fs = require('fs');

const env = Object.fromEntries(fs.readFileSync('/home/user/pbs-go/.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const SB = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const BASE = 'http://localhost:3000';
const results = [];
const check = (name, ok, info = '') => { results.push([ok, name, info]); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');

(async () => {
  const browser = await chromium.launch();

  // ---------- 1. signed-out visitors cannot open private pages
  {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    const priv = ['/home', '/clubs', '/events', '/messages', '/notifications', '/people', '/points', '/market', '/admin', '/profile/edit', '/welcome'];
    const bad = [];
    for (const r of priv) { await p.goto(BASE + r, { waitUntil: 'networkidle' }); if (!p.url().includes('/login')) bad.push(r + ' -> ' + p.url()); }
    check('Signed-out visitors are sent to /login from ' + priv.length + ' private pages', bad.length === 0, bad.join(', '));
    const pub = [];
    for (const r of ['/login', '/rules', '/privacy']) { const res = await p.goto(BASE + r, { waitUntil: 'networkidle' }); if (res.status() !== 200 || !p.url().endsWith(r)) pub.push(r); }
    check('/login, /rules and /privacy are open to everyone', pub.length === 0, pub.join(', '));
    const robots = await p.request.get(BASE + '/login'); 
    check('Pages are marked noindex', /noindex/i.test(robots.headers()['x-robots-tag'] || ''), robots.headers()['x-robots-tag'] || 'missing');
    await ctx.close();
  }

  // ---------- 2. layouts
  for (const [name, w, h] of [['desktop', 1440, 900], ['laptop', 1280, 770], ['tablet', 768, 1024], ['phone', 390, 844], ['small-phone', 360, 640]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
    const m = await p.evaluate(() => ({ sideScroll: document.documentElement.scrollWidth > innerWidth, h1: document.querySelector('h1')?.innerText.replace(/\n/g, ' '), btn: document.querySelector('.lp-gbtn')?.getBoundingClientRect().bottom <= innerHeight, ribbon: !!document.querySelector('.lp-ribbon'), logo: !!document.querySelector('img[alt="Loop"]') }));
    check(`Login page ${name} (${w}x${h}): fits, headline, logo, ribbon, button on screen`, !m.sideScroll && m.h1 === 'Your school. Your community.' && m.ribbon && m.logo && m.btn, JSON.stringify(m));
    await ctx.close();
  }

  // headline stays on two lines at every desktop width
  {
    const bad = [];
    for (const w of [1024, 1100, 1180, 1280, 1366, 1440, 1536, 1920, 2560]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage();
      await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
      const m = await p.evaluate(() => { const h = document.querySelector('h1'); const fs = parseFloat(getComputedStyle(h).fontSize); const art = document.querySelector('.lp-art').getBoundingClientRect(); const spans = [...h.querySelectorAll('span')].map(s => s.getBoundingClientRect().right); return { lines: Math.round(h.getBoundingClientRect().height / (fs * 1.03)), clear: Math.max(...spans) < art.left }; });
      if (m.lines !== 2 || !m.clear) bad.push(w + ':' + JSON.stringify(m));
      await ctx.close();
    }
    check('Headline stays on two lines and clear of the artwork from 1024 to 2560 px wide', bad.length === 0, bad.join(' '));
  }

  // ---------- 3. demo account login, persistence, existing features, logout
  for (const [who, email, routes] of [
    ['student Layla', 'demo.layla@pioneers.edu.ps', ['/home', '/clubs', '/events', '/messages', '/notifications', '/people', '/points', '/leaderboard', '/challenges', '/polls', '/volunteering', '/tutors', '/market', '/tawjihi', '/council', '/suggestions', '/counselor', '/more']],
    ['admin Rania', 'demo.rania@pioneers.edu.ps', ['/home', '/admin', '/admin/students', '/admin/announcements', '/admin/settings', '/moderation']],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
    await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await p.locator('form', { has: p.locator(`input[value="${email}"]`) }).locator('button').click();
    await p.waitForURL('**/home', { timeout: 20000 }).catch(() => {});
    check(`${who}: demo sign-in lands on /home`, p.url().endsWith('/home'), p.url());
    const cookies = (await ctx.cookies()).filter(c => c.name.startsWith('sb-'));
    check(`${who}: session cookie is set`, cookies.length > 0, cookies.map(c => c.name).join(','));
    await p.reload({ waitUntil: 'networkidle' });
    check(`${who}: still signed in after refresh`, p.url().endsWith('/home'), p.url());
    await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
    check(`${who}: opening /login while signed in goes back to /home`, p.url().endsWith('/home'), p.url());
    const bad = [];
    for (const r of routes) {
      const res = await p.goto(BASE + r, { waitUntil: 'networkidle' });
      const t = await text(p);
      if (res.status() >= 400 || !p.url().endsWith(r) || t.length < 30 || /Application error|couldn.t load|Something went wrong/i.test(t)) bad.push(`${r} [${res.status()} ${p.url().replace(BASE, '')}]`);
    }
    check(`${who}: ${routes.length} existing pages load`, bad.length === 0, bad.join(', '));
    // logout
    await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
    await p.locator('header button[aria-label="Profile menu"]').first().click();
    await p.getByRole('menuitem', { name: 'Sign out' }).click();
    await p.waitForURL('**/login', { timeout: 20000 }).catch(() => {});
    check(`${who}: Sign out returns to /login`, p.url().includes('/login'), p.url());
    await p.goto(BASE + '/home', { waitUntil: 'networkidle' });
    check(`${who}: /home is closed again after sign out`, p.url().includes('/login'), p.url());
    await p.goBack().catch(() => {}); await p.waitForLoadState('networkidle');
    check(`${who}: Back button after sign out does not reopen private pages`, !(await text(p)).includes('Good ') || p.url().includes('/login'), p.url());
    await ctx.close();
  }

  // ---------- 4. returning user through the real callback (PKCE magic link stands in for Google)
  {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    const store = {};
    const sb = createClient(SB, KEY, { auth: { flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false, storage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } } } });
    const email = 'demo.maya@pioneers.edu.ps';
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: BASE + '/auth/callback', shouldCreateUser: false } });
    check('Callback test: sign-in link requested for a returning student', !error, error?.message || '');
    const verifierKey = Object.keys(store).find(k => k.endsWith('code-verifier'));
    const verifier = store[verifierKey];
    const cookieName = 'sb-' + new URL(SB).hostname.split('.')[0] + '-auth-token-code-verifier';
    await ctx.addCookies([{ name: cookieName, value: 'base64-' + Buffer.from(verifier).toString('base64url'), domain: 'localhost', path: '/' }]);
    let link = null;
    for (let i = 0; i < 20 && !link; i++) {
      const list = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
      const msg = list.messages.find(m => m.To.some(t => t.Address === email));
      if (msg) { const full = await (await fetch('http://127.0.0.1:54324/api/v1/message/' + msg.ID)).json(); link = (full.HTML + ' ' + full.Text).match(/http:\/\/[^\s"'<>]*\/auth\/v1\/verify\?[^\s"'<>]+/)?.[0]?.replace(/&amp;/g, '&'); }
      else await new Promise(r => setTimeout(r, 500));
    }
    check('Callback test: sign-in email arrived', !!link);
    if (link) {
      await p.goto(link, { waitUntil: 'networkidle' });
      check('Returning student: /auth/callback signs them in and opens /home', p.url().endsWith('/home'), p.url());
      await p.reload({ waitUntil: 'networkidle' });
      check('Returning student: still signed in after refresh', p.url().endsWith('/home'), p.url());
      check('Returning student: dashboard content shows', (await text(p)).length > 100);
    }
    await ctx.close();
  }

  // ---------- 5. failures and clear messages
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    for (const [name, url, expect] of [
      ['Closing Google', '/auth/callback?error=access_denied&error_description=Access+denied', /closed Google/i],
      ['Account refused by the database', '/auth/callback?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user', /couldn.t sign you in with that account/i],
      ['Bad or expired code', '/auth/callback?code=not-a-real-code', /didn.t finish/i],
      ['Nothing at all', '/auth/callback', /didn.t finish/i],
    ]) {
      await p.goto(BASE + url, { waitUntil: 'networkidle' });
      const alert = await p.locator('[role=alert]').first().innerText().catch(() => '');
      check(`Failed sign-in — ${name}: lands on /login with a clear message`, p.url().includes('/login?error=') && expect.test(alert), alert.replace(/\s+/g, ' ').slice(0, 90));
    }
    // Google button when Google is not switched on for this Supabase project
    await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /Continue with Google/ }).click();
    const real = p.locator('[role=alert]', { hasText: /\S/ }).first();
    await real.waitFor({ timeout: 8000 }).catch(() => {});
    const msg = await real.innerText().catch(() => '');
    const enabled = await p.getByRole('button', { name: /Continue with Google/ }).isEnabled().catch(() => false);
    check('Google button with Google switched off: clear message, no raw error page, button usable again', /isn.t switched on/i.test(msg) && p.url().includes('/login') && enabled, msg.slice(0, 90));
    await ctx.close();

    // Unsupported accounts cannot be created
    const anon = createClient(SB, KEY, { auth: { persistSession: false } });
    const g = await anon.auth.signInWithOtp({ email: 'someone.random@gmail.com', options: { shouldCreateUser: true } });
    check('Unsupported account (Gmail) is refused', !!g.error, g.error?.message?.slice(0, 80));
    const s = await anon.auth.signUp({ email: 'fake.student@pioneers.edu.ps', password: 'Test-pass-12345' });
    check('School-looking email cannot create a password account', !!s.error, s.error?.message?.slice(0, 80));
    const { execSync } = require('child_process');
    const n = execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -qtAc "select count(*) from auth.users where email in ('someone.random@gmail.com','fake.student@pioneers.edu.ps')"`).toString().trim();
    check('Refused accounts were not created in the database', n === '0', 'rows: ' + n);
    const l = await anon.auth.signInWithPassword({ email: 'demo.layla@pioneers.edu.ps', password: 'wrong-password' });
    check('Wrong password on a demo account is refused', !!l.error, l.error?.message);
  }

  await browser.close();
  const failed = results.filter(r => !r[0]);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
