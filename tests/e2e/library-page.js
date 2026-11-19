const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')); };
const SCHOOL = '00000000-0000-0000-0000-00000000a001';

(async () => {
  const b = await chromium.launch();
  q(`delete from public.library_resources where title like 'E2E Tile %'`);
  q(`insert into public.library_resources (school_id, source, subject_id, title, type, author, published_at, views_count, downloads_count, rating_avg, rating_count, link_url) select '${SCHOOL}', 'official', id, 'E2E Tile Notes', 'pdf_notes', 'Loop Team', now(), 12400, 0, 4.9, 3, 'https://example.org/n' from public.study_categories order by sort limit 1`);
  q(`insert into public.library_resources (school_id, source, subject_id, title, type, author, published_at, link_url) select '${SCHOOL}', 'official', id, 'E2E Tile Guide', 'study_guide', 'Loop Team', now(), 'https://example.org/g' from public.study_categories order by sort limit 1`);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator('input[value="demo.layla@pioneers.edu.ps"]') }).locator('button').click();
  await p.waitForURL('**/home'); await p.waitForTimeout(600);
  await p.goto(BASE + '/academic-resources', { waitUntil: 'networkidle' });
  check('The Library page has its banner and the Academic Library title', /Academic Library/.test(await p.locator('[data-banner-title]').innerText()) && (await p.locator('[data-banner] img').evaluate((i) => i.complete && i.naturalWidth > 0)));
  const pills = await p.locator('[data-library-filters] a').allInnerTexts();
  check('Type filters: All Resources, Notes, Textbooks, Study Guides, Past Papers, Practice, Worksheets', JSON.stringify(pills.map((x) => x.trim())) === JSON.stringify(['All Resources', 'Notes', 'Textbooks', 'Study Guides', 'Past Papers', 'Practice', 'Worksheets']), pills.join(','));
  check('My Library, My Contributions and Suggest a Resource are there', (await p.locator('[data-library-links] a').count()) >= 3);
  check('Top Rated and Recently Added show resource tiles', (await p.locator('[data-section=top-rated] [data-resource]').count()) >= 1 && (await p.locator('[data-section=recent] [data-resource]').count()) >= 2);
  const tile = p.locator('[data-section=recent] [data-resource]', { hasText: 'E2E Tile Notes' }).first();
  const tt = await tile.innerText();
  check('A tile shows title, who shared it, Official label, rating and views (12.4K)', /E2E Tile Notes/.test(tt) && /By Loop Team/.test(tt) && /Official/.test(tt) && /4\.9/.test(tt) && /12\.4K/.test(tt), tt.replace(/\s+/g, ' '));
  check('Browse by Subject shows subject tiles and the Study Smart card', (await p.locator('[data-category]').count()) >= 6 && (await p.locator('[data-promo]').count()) === 1);
  // bookmark
  const id = await tile.getAttribute('data-resource');
  await tile.locator('[data-save-bookmark]').click(); await p.waitForTimeout(1500);
  check('The bookmark saves the resource to My Library', q(`select count(*) from public.library_saves where resource_id='${id}'`) === '1');
  await p.reload({ waitUntil: 'networkidle' });
  check('The saved bookmark stays filled after reload', (await p.locator(`[data-resource="${id}"] [data-save-bookmark]`).first().getAttribute('aria-pressed')) === 'true');
  await p.locator(`[data-resource="${id}"] [data-save-bookmark]`).first().click(); await p.waitForTimeout(1500);
  check('Tapping it again removes it', q(`select count(*) from public.library_saves where resource_id='${id}'`) === '0');
  // filter and search
  await p.locator('[data-library-filters] a', { hasText: 'Notes' }).click(); await p.waitForURL('**type=notes**'); await p.waitForSelector('[data-section=results]');
  const only = await p.locator('[data-section=results] [data-resource]').allInnerTexts();
  check('The Notes filter shows only notes', only.length >= 1 && only.every((x) => /PDF notes/.test(x)) && only.some((x) => /E2E Tile Notes/.test(x)));
  await p.goto(BASE + '/academic-resources?type=guides', { waitUntil: 'networkidle' });
  check('The Study Guides filter shows guides, not notes', /E2E Tile Guide/.test(await p.locator('[data-section=results]').innerText()) && !/E2E Tile Notes/.test(await p.locator('[data-section=results]').innerText()));
  await p.goto(BASE + '/academic-resources?q=Tile+Notes', { waitUntil: 'networkidle' });
  check('Search finds a resource by name', /E2E Tile Notes/.test(await p.locator('[data-section=results]').innerText()));
  await p.goto(BASE + '/academic-resources?view=recent', { waitUntil: 'networkidle' });
  check('See all (Recently Added) opens the full list', (await p.locator('[data-section=recent] [data-resource]').count()) >= 2 && (await p.locator('[data-section=top-rated]').count()) === 0);
  for (const w of [360, 390]) {
    const c2 = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
    const m = await c2.newPage();
    await m.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await m.locator('form', { has: m.locator('input[value="demo.layla@pioneers.edu.ps"]') }).locator('button').click();
    await m.waitForURL('**/home');
    await m.goto(BASE + '/academic-resources', { waitUntil: 'networkidle' });
    check(`Phone ${w}px: the Library fits the screen`, (await m.evaluate((w) => Math.max(document.documentElement.scrollWidth, innerWidth) - w, w)) <= 0);
    await c2.close();
  }
  q(`delete from public.library_resources where title like 'E2E Tile %'`);
  await b.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
