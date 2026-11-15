const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const BASE = 'http://localhost:3000';
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const text = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
const sql = (q) => execSync(`docker exec -i supabase_db_pbs-go psql -U postgres -d postgres -Atq`, { input: q }).toString().trim();
const ID = { rania: '00000000-0000-0000-0000-0000000000a1', layla: '00000000-0000-0000-0000-0000000000a3', yousef: '00000000-0000-0000-0000-0000000000a4', maya: '00000000-0000-0000-0000-0000000000a5' };
const go = (p, u) => p.goto(BASE + u, { waitUntil: 'networkidle' });
const waitText = (p, re, t = 20000) => p.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re.source, { timeout: t });
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const PDF = path.join(__dirname, 'sample.pdf');
const PNG = path.join(__dirname, 'proof.png');

async function login(browser, name, viewport = { width: 1280, height: 850 }) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  await go(p, '/login');
  await p.locator('.lp-demo button', { hasText: name }).click();
  await p.waitForURL('**/home', { timeout: 20000 });
  return { ctx, p };
}

async function fillForm(p, v) {
  await p.fill('input[name=title]', v.title);
  await p.fill('textarea[name=description]', v.description || 'Clear notes covering every algebra topic in detail.');
  await p.selectOption('select[name=subject_id]', { label: v.subject || 'SAT' });
  await p.selectOption('select[name=type]', v.type || 'pdf_notes');
  if (v.author) await p.fill('input[name=author]', v.author);
  if (v.link) {
    await p.getByRole('radio', { name: /External link/ }).click();
    await p.fill('input[name=link_url]', v.link);
  } else if (v.file) {
    await p.locator('[data-file-input]').setInputFiles(v.file);
    await waitText(p, /📎/);
    if (v.rights !== false) await p.locator('input[name=rights_confirmed]').check();
    if (v.downloadable) await p.locator('input[name=downloadable]').check();
  }
}

(async () => {
  const browser = await chromium.launch();
  sql(`delete from public.library_resources; delete from public.library_settings; delete from public.rate_events;
       delete from public.points_ledger where reason = 'library_resource';
       delete from public.notifications where kind like 'library_%';
       update public.study_categories set name = name;`);
  const rania = await login(browser, 'Rania Haddad');
  const maya = await login(browser, 'Maya Odeh');
  const layla = await login(browser, 'Omar Khalil');
  const yousef = await login(browser, 'Yousef Saleh');
  const mobile = await login(browser, 'Yousef Saleh', { width: 390, height: 800 });
  let resourceId = '';
  let linkId = '';

  // 1. Home
  {
    const p = maya.p;
    await go(p, '/academic-resources');
    const t = await text(p);
    check('The home page has the title and subtitle', /Academic Resources/.test(t) && /Your school library, all in one place\./.test(t));
    check('The home page has a search bar and a visible Suggest a Resource button', (await p.locator('main input[name=q]').count()) === 1 && (await p.locator('[data-suggest]').isVisible()));
    const subjects = await p.locator('[data-category]').allInnerTexts();
    check('Browse by Subject shows the six subjects', ['SAT', 'AP Chemistry', 'AP Biology', 'AP Physics', 'AP Calculus', 'Other subjects'].every((s) => subjects.some((x) => x.includes(s))), subjects.join(' | '));
    check('Top rated and Recently added sections exist', (await p.locator('[data-section=top-rated]').count()) === 1 && (await p.locator('[data-section=recent]').count()) === 1);
    check('A student does not see the review or manage links', !/Review dashboard|Manage library/.test(t));
  }

  // 2. Suggest a resource (Maya, a student)
  {
    const p = maya.p;
    await go(p, '/academic-resources/suggest');
    await fillForm(p, { title: 'E2E SAT Algebra Notes', author: 'Maya Odeh', file: PDF });
    await p.locator('[data-cover-input]').setInputFiles(PNG);
    await p.waitForTimeout(1500);
    await p.getByRole('button', { name: /Review and send/ }).click();
    await waitText(p, /Check before you send/);
    const summary = await p.locator('[data-summary]').innerText();
    check('A summary is shown before sending', /E2E SAT Algebra Notes/.test(summary) && /sample\.pdf/.test(summary) && /SAT/.test(summary));
    await p.getByRole('button', { name: /Submit for review/ }).click();
    await p.waitForURL('**/my-contributions?sent=1', { timeout: 20000 });
    await waitText(p, /Pending review/);
    const t = await text(p);
    check('The student lands on My Contributions with the resource Pending', /Pending review/.test(t) && /E2E SAT Algebra Notes/.test(t) && /Sent! A reviewer/.test(t));
    resourceId = sql(`select id from public.library_resources where title = 'E2E SAT Algebra Notes'`);
    check('The file is stored privately', sql(`select count(*) from storage.objects where bucket_id = 'library-files'`) !== '0' && sql(`select public from storage.buckets where id = 'library-files'`) === 'f');
  }

  // 3. Privacy before approval
  {
    const p = yousef.p;
    await go(p, '/academic-resources/sat');
    check('Other students do not see a pending resource', !/E2E SAT Algebra Notes/.test(await text(p)));
    const res = await p.goto(BASE + '/academic-resources/resource/' + resourceId, { waitUntil: 'networkidle' });
    check('Its page is not found for other students', res.status() === 404 || /find that/i.test(await text(p)));
    const f = await p.evaluate(async (id) => (await fetch(`/api/library/${id}/file?kind=read`, { redirect: 'manual' })).status, resourceId);
    check('Its file cannot be opened by other students', f === 404 || f === 0, String(f));
    const rev = await p.goto(BASE + '/academic-resources/review', { waitUntil: 'networkidle' });
    check('Students cannot open the review dashboard', /\/academic-resources$/.test(p.url()));
  }

  // 4. Review: reject with a reason
  {
    const p = layla.p;
    await go(p, '/academic-resources');
    check('The Council sees the review link', /Review dashboard/.test(await text(p)));
    await go(p, '/academic-resources/review');
    const t = await text(p);
    check('The review dashboard lists the pending submission with the student', /Pending \(1\)/.test(t) && /E2E SAT Algebra Notes/.test(t) && /Maya Odeh/.test(t));
    await p.locator('[data-submission]').first().click();
    await waitText(p, /Decision/);
    check('The reviewer can preview the file', (await p.locator('[data-preview]').count()) === 1);
    await p.locator('[data-preview]').click();
    await p.waitForURL('**/read?rev=*');
    await p.waitForSelector('[data-reader]', { timeout: 15000 });
    check('The preview opens a reader', (await p.locator('[data-reader]').count()) === 1);
    await p.goBack();
    await waitText(p, /Decision/);
    await p.locator('[data-reject]').click();
    await waitText(p, /Explain why it was not approved/);
    check('Rejecting without a reason is refused', true);
    await p.fill('textarea[name=note]', 'Please add the chapter names to the description.');
    await p.locator('[data-reject]').click();
    await p.waitForURL('**/review?done=rejected', { timeout: 20000 });
    await waitText(p, /Sent back with your explanation/);
    check('A reason lets the reviewer reject', /Sent back with your explanation/.test(await text(p)));
    check('The student is notified', sql(`select count(*) from public.notifications where recipient_id='${ID.maya}' and kind='library_rejected'`) === '1');
  }

  // 5. The student fixes and resubmits; reviewers approve
  {
    const p = maya.p;
    await go(p, '/academic-resources/my-contributions');
    let t = await text(p);
    check('The student sees Rejected with the feedback', /Rejected/.test(t) && /chapter names/.test(t));
    await p.locator('[data-edit]').first().click();
    await p.waitForURL('**/edit');
    check('The edit form keeps the file and the earlier answers', (await p.locator('input[name=title]').inputValue()) === 'E2E SAT Algebra Notes' && /sample\.pdf/.test(await text(p)));
    await p.fill('textarea[name=description]', 'Clear notes covering every algebra topic, chapters 1 to 6.');
    await p.locator('input[name=rights_confirmed]').check();
    await p.getByRole('button', { name: /Review and send/ }).click();
    await p.getByRole('button', { name: /Submit for review/ }).click();
    await p.waitForURL('**/my-contributions?sent=1', { timeout: 20000 });
    await waitText(p, /Pending review/);
    check('Resubmitting puts it back in review', /Pending review/.test(await text(p)));

    const q = layla.p;
    await go(q, '/academic-resources/review');
    await q.locator('[data-submission]').first().click();
    await waitText(q, /Decision/);
    await q.locator('[data-approve]').click();
    await q.waitForURL('**/review?done=approved', { timeout: 20000 });
    await waitText(q, /Approved\. The student was notified/);
    check('A reviewer can approve', /Approved\. The student was notified/.test(await text(q)));

    await go(p, '/academic-resources/my-contributions');
    t = await text(p);
    check('The student sees Approved and the points earned', /Approved/.test(t) && /Points earned/.test(t) && /⭐ 10/.test(t), t.slice(0, 200));
    check('Points were added to the ledger once', sql(`select count(*) from public.points_ledger where profile_id='${ID.maya}' and reason='library_resource'`) === '1');
    await go(p, '/academic-resources/my-contributions?status=approved');
    check('The status tabs filter the list', (await p.locator('[data-contribution=approved]').count()) === 1);
  }

  // 6. A published resource: card, detail, reading, downloads, ratings, saving
  {
    const p = yousef.p;
    await go(p, '/academic-resources');
    const card = p.locator(`[data-resource="${resourceId}"]`).first();
    const ct = await card.innerText();
    check('It appears under Recently added as a Community resource with the submitter', /Community/.test(ct) && /Maya Odeh/.test(ct) && /E2E SAT Algebra Notes/.test(ct));
    check('The card shows views, rating and reviews', (await card.locator('[data-stat]').count()) >= 3);
    await go(p, '/academic-resources/sat');
    check('It is listed on the SAT subject page', (await p.locator(`[data-resource="${resourceId}"]`).count()) === 1);
    await go(p, '/academic-resources/resource/' + resourceId);
    const t = await text(p);
    check('The detail page shows title, description, submitter and label', /E2E SAT Algebra Notes/.test(t) && /chapters 1 to 6/.test(t) && /Shared by Maya Odeh/.test(t) && /Community/.test(t));
    check('There is a Read in Loop button', (await p.locator('[data-read]').count()) === 1);
    check('No Download button for a read-only file', (await p.locator('[data-download]').count()) === 0);
    const dl = await p.evaluate(async (id) => (await fetch(`/api/library/${id}/file?kind=download`, { redirect: 'manual' })).status, resourceId);
    check('The download route refuses read-only files', dl === 404 || dl === 0, String(dl));
    await p.waitForTimeout(2500);
    check('The view is counted once', sql(`select views_count from public.library_resources where id='${resourceId}'`) === '1');
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    check('Refreshing does not count again', sql(`select views_count from public.library_resources where id='${resourceId}'`) === '1');

    await p.locator('[data-read]').click();
    await p.waitForURL('**/read');
    await p.waitForSelector('[data-reader]', { timeout: 15000 });
    check('The in-app reader opens', (await p.locator('[data-reader]').count()) === 1);
    const hdr = await p.evaluate(async (id) => { const r = await fetch(`/api/library/${id}/file?kind=read`); return { status: r.status, type: r.headers.get('content-type') }; }, resourceId);
    check('The reader file is a PDF', hdr.status === 200 && /pdf/.test(hdr.type || ''), JSON.stringify(hdr));
    await p.goBack();

    // rating
    await p.locator('[data-rate-form] label').nth(4).click();
    await p.fill('[data-rate-form] textarea', 'Super clear, thank you!');
    await p.getByRole('button', { name: /Submit rating/ }).click();
    await waitText(p, /Rating is saved|Thanks for rating/);
    await p.reload({ waitUntil: 'networkidle' });
    const rt = await text(p);
    check('The rating and written review appear', /Super clear, thank you!/.test(rt) && /1 ratings/.test(rt) && (await p.locator('[data-avg]').innerText()) === '5.0');
    check('The review shows the reviewer name', /Yousef Saleh/.test(await p.locator('[data-review]').first().innerText()));
    await p.locator('[data-rate-form] label').nth(3).click();
    await p.getByRole('button', { name: /Update my rating/ }).click();
    await waitText(p, /Thanks for rating/);
    check('A student can change their rating, still one rating', sql(`select rating_count || '/' || rating_avg from public.library_resources where id='${resourceId}'`) === '1/4.00');

    // save
    await p.locator('[data-save]').click();
    await waitText(p, /Saved to My Library/);
    await go(p, '/academic-resources/my-library');
    check('Saved resources appear in My Library', (await p.locator(`[data-resource="${resourceId}"]`).count()) === 1);
    await go(maya.p, '/academic-resources/my-library');
    check('My Library is private', (await maya.p.locator('[data-resource]').count()) === 0);

    // no rating on your own resource
    await go(maya.p, '/academic-resources/resource/' + resourceId);
    check('The owner cannot rate their own resource', (await maya.p.locator('[data-rate-form]').count()) === 0);
    await maya.p.waitForTimeout(2200);
    check('Owner views are not counted', sql(`select views_count from public.library_resources where id='${resourceId}'`) === '1');
  }

  // 7. Edit an approved resource: old version stays until the update is approved
  {
    const p = maya.p;
    await go(p, '/academic-resources/resource/' + resourceId + '/edit');
    check('Editing an approved resource warns about review', /reviewed before they go live/.test(await text(p)));
    await p.fill('input[name=title]', 'E2E SAT Algebra Notes v2');
    await p.locator('input[name=rights_confirmed]').check();
    await p.getByRole('button', { name: /Review and send/ }).click();
    await p.getByRole('button', { name: /Submit for review/ }).click();
    await p.waitForURL('**/my-contributions?sent=1', { timeout: 20000 });
    await go(yousef.p, '/academic-resources/resource/' + resourceId);
    check('The approved version stays visible while the update waits', /E2E SAT Algebra Notes/.test(await text(yousef.p)) && !/v2/.test(await yousef.p.locator('[data-resource-title]').innerText()));
    await go(layla.p, '/academic-resources/review');
    await layla.p.locator('[data-submission]').first().click();
    await waitText(layla.p, /What changed/);
    check('Reviewers see the old and new version side by side', (await layla.p.locator('[data-before]').count()) >= 1 && /Before: E2E SAT Algebra Notes/.test(await text(layla.p)));
    await layla.p.locator('[data-approve]').click();
    await layla.p.waitForURL('**/review?done=approved', { timeout: 20000 });
    await go(yousef.p, '/academic-resources/resource/' + resourceId);
    check('An approved update replaces the live version', /v2/.test(await yousef.p.locator('[data-resource-title]').innerText()));
    check('Editing earned no extra points', sql(`select count(*) from public.points_ledger where profile_id='${ID.maya}' and reason='library_resource'`) === '1');
  }

  // 8. A link resource
  {
    const p = maya.p;
    await go(p, '/academic-resources/suggest?subject=' + sql(`select id from public.study_categories where slug='ap-biology' limit 1`));
    await fillForm(p, { title: 'E2E Biology Videos', subject: 'AP Biology', type: 'video', link: 'https://example.org/biology-videos' });
    await p.getByRole('button', { name: /Review and send/ }).click();
    await p.getByRole('button', { name: /Save as draft/ }).click();
    await p.waitForURL('**/my-contributions?saved=1', { timeout: 20000 });
    check('A draft can be saved', /Draft/.test(await text(p)) && /Draft saved/.test(await text(p)));
    linkId = sql(`select id from public.library_resources where title = 'E2E Biology Videos'`);
    await go(p, '/academic-resources/resource/' + linkId + '/edit');
    await p.getByRole('button', { name: /Review and send/ }).click();
    await p.getByRole('button', { name: /Submit for review/ }).click();
    await p.waitForURL('**/my-contributions?sent=1', { timeout: 20000 });
    await go(layla.p, '/academic-resources/review');
    await layla.p.locator('[data-submission]').first().click();
    await waitText(layla.p, /Decision/);
    check('Reviewers can open the link', (await layla.p.locator('[data-open-link]').count()) === 1);
    await layla.p.locator('[data-approve]').click();
    await layla.p.waitForURL('**/review?done=approved', { timeout: 20000 });
    await go(yousef.p, '/academic-resources/resource/' + linkId);
    const t = await text(yousef.p);
    check('A link resource shows Open Resource, not Download', (await yousef.p.locator('[data-open-link]').count()) === 1 && (await yousef.p.locator('[data-download]').count()) === 0);
    const rel = await yousef.p.locator('[data-open-link]').getAttribute('rel');
    check('External links open safely', /noopener/.test(rel || '') && (await yousef.p.locator('[data-open-link]').getAttribute('target')) === '_blank');
  }

  // 9. Official library (admin)
  {
    const p = rania.p;
    await go(p, '/academic-resources');
    check('Admins see the manage link', /Manage library/.test(await text(p)));
    await go(p, '/academic-resources/manage/new');
    await fillForm(p, { title: 'E2E Official Chemistry Guide', subject: 'AP Chemistry', type: 'study_guide', link: 'https://example.org/official-chem' });
    await p.getByRole('button', { name: /Save resource/ }).click();
    await p.waitForURL('**/resource/*', { timeout: 20000 });
    await waitText(p, /Official/);
    check('Admins add Official resources directly', /Official/.test(await text(p)) && !/Pending/.test(await text(p)));
    await go(yousef.p, '/academic-resources/ap-chemistry');
    check('Official resources show the Official label to students', (await yousef.p.locator('[data-source=official]').count()) === 1);
    await go(maya.p, '/academic-resources/manage');
    check('Students cannot open Manage', /\/academic-resources$/.test(maya.p.url()));
    await go(p, '/academic-resources/manage');
    await p.fill('input[name=points]', '25');
    await p.getByRole('button', { name: 'Save' }).click();
    await waitText(p, /Saved/);
    check('Admins can change the points', sql(`select points_per_approval from public.library_settings`) === '25');
    await go(p, '/academic-resources/manage');
    await p.fill('input[name=points]', '10');
    await p.getByRole('button', { name: 'Save' }).click();
    await waitText(p, /Saved/);
  }

  // 10. Flags are internal
  {
    const p = layla.p;
    await go(p, '/academic-resources/resource/' + resourceId);
    check('Reviewers see the flag tools', (await p.locator('[data-section=reviewer]').count()) === 1);
    await p.fill('[data-section=reviewer] textarea[name=reason]', 'Looks copied from a textbook');
    await p.getByRole('button', { name: /Flag for review/ }).click();
    await waitText(p, /Flagged for review/);
    await go(yousef.p, '/academic-resources/resource/' + resourceId);
    check('Ordinary students have no report or flag button', !/Flag|Report/.test(await text(yousef.p)) && (await yousef.p.locator('[data-section=reviewer]').count()) === 0);
    await go(p, '/academic-resources/review?tab=flagged');
    check('Open flags appear for reviewers', /Looks copied from a textbook/.test(await text(p)));
    await go(p, '/academic-resources/resource/' + resourceId);
    await p.getByRole('button', { name: /Hide it/ }).click();
    await p.waitForFunction(() => !/Hide it/.test(document.body.innerText), null, { timeout: 15000 });
    await go(yousef.p, '/academic-resources/sat');
    check('A hidden resource disappears from browsing', !/E2E SAT Algebra Notes/.test(await text(yousef.p)));
    await go(p, '/academic-resources/resource/' + resourceId);
    await p.getByRole('button', { name: /Show it again/ }).click();
    await p.waitForFunction(() => !/Show it again/.test(document.body.innerText), null, { timeout: 15000 });
    await go(yousef.p, '/academic-resources/sat');
    check('A restored resource is back', /E2E SAT Algebra Notes/.test(await text(yousef.p)));
    check('The action record is kept', Number(sql(`select count(*) from public.library_actions`)) >= 3);
  }

  // 11. Search and top rated
  {
    const p = yousef.p;
    await go(p, '/academic-resources?q=biology');
    check('Search finds resources by title and subject', /E2E Biology Videos/.test(await text(p)) && !/E2E Official Chemistry/.test(await text(p)));
    await go(p, '/academic-resources?q=zzzznothing');
    check('Search shows a friendly empty state', /Nothing found/.test(await text(p)));
    await go(p, '/academic-resources');
    check('Top rated lists the rated resource', (await p.locator('[data-section=top-rated] [data-resource]').count()) === 1);
  }

  // 12. Deleting
  {
    const p = maya.p;
    await go(p, '/academic-resources/my-contributions');
    p.once('dialog', (d) => d.accept());
    await p.locator('[data-contribution]', { hasText: 'E2E Biology Videos' }).locator('[data-delete]').click();
    await waitText(p, /Points earned from resources/);
    await p.waitForTimeout(800);
    check('Deleting removes it from My Contributions', !/E2E Biology Videos/.test(await text(p)));
    await go(yousef.p, '/academic-resources/ap-biology');
    check('A deleted resource leaves public browsing', !/E2E Biology Videos/.test(await text(yousef.p)));
    check('The history is kept for the reviewers', sql(`select count(*) from public.library_revisions where resource_id='${linkId}'`) !== '0' && sql(`select deleted_at is not null from public.library_resources where id='${linkId}'`) === 't');
  }

  // 13. Phone width
  {
    const p = mobile.p;
    for (const u of ['/academic-resources', '/academic-resources/sat', '/academic-resources/resource/' + resourceId, '/academic-resources/suggest', '/academic-resources/my-library', '/academic-resources/my-contributions', '/academic-resources/resource/' + resourceId + '/read']) {
      await go(p, u);
      check(`No sideways scrolling on a phone: ${u.replace(resourceId, ':id')}`, await noSideScroll(p));
    }
    await go(p, '/academic-resources');
    check('The Suggest a Resource button is visible on a phone', await p.locator('[data-suggest]').isVisible());
    await p.screenshot({ path: path.join(__dirname, '..', '..', '..', 'loop-tests', 'lib-mobile-home.png'), fullPage: true }).catch(() => {});
    const q = layla.p;
    await go(q, '/academic-resources/review');
    check('The review dashboard has no side scrolling', await noSideScroll(q));
  }

  await browser.close();
})();
