const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:3000';
const DB = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const q = (sql) => execSync(`psql "${DB}" -qtA -F '|' -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const check = (name, ok, info = '') => console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : ''));
const LAYLA = '00000000-0000-0000-0000-0000000000a3', OMAR = '00000000-0000-0000-0000-0000000000a2', SCHOOL = '00000000-0000-0000-0000-00000000a001';
const login = async (b, email) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.locator('form', { has: p.locator(`input[value="${email}"]`) }).locator('button').click();
  await p.waitForURL('**/home');
  return { ctx, p };
};

(async () => {
  const b = await chromium.launch();
  q(`delete from public.tutor_application_documents where profile_id='${OMAR}'; delete from public.tutor_applications where profile_id='${OMAR}'; delete from public.tutor_reviews where tutor_id='${OMAR}'; delete from public.tutoring_requests where tutor_id='${OMAR}'`);
  q(`insert into public.tutor_applications (id, school_id, profile_id, status) values ('00000000-0000-0000-0000-00000000f0a1','${SCHOOL}','${OMAR}','approved')`);
  const shared = `${SCHOOL}/${OMAR}/cv.pdf`, hidden = `${SCHOOL}/${OMAR}/private.pdf`;
  q(`insert into storage.objects (bucket_id, name, owner) values ('tutor-docs','${shared}','${OMAR}'),('tutor-docs','${hidden}','${OMAR}') on conflict do nothing`);
  q(`insert into public.tutor_application_documents (id, application_id, school_id, profile_id, path, name, kind, size) values ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-00000000f0a1','${SCHOOL}','${OMAR}','${shared}','Omar CV.pdf','cv',1000),('00000000-0000-0000-0000-00000000d002','00000000-0000-0000-0000-00000000f0a1','${SCHOOL}','${OMAR}','${hidden}','Private grades.pdf','academic',1000)`);

  const layla = await login(b, 'demo.layla@pioneers.edu.ps');
  let p = layla.p;
  await p.goto(`${BASE}/tutors/${OMAR}`, { waitUntil: 'networkidle' });
  check('A tutor with nothing shared shows a clear message', /has not shared a CV/.test(await p.innerText('body')) && (await p.locator('[data-tutor-doc]').count()) === 0);
  let r = await p.request.get(`${BASE}/api/tutor-doc/00000000-0000-0000-0000-00000000d001`, { maxRedirects: 0 });
  check('A private document cannot be opened by another student', r.status() === 404, 'status ' + r.status());

  q(`update public.tutor_application_documents set public_on_profile = true where id='00000000-0000-0000-0000-00000000d001'`);
  await p.goto(`${BASE}/tutors/${OMAR}`, { waitUntil: 'networkidle' });
  check('A shared CV appears on the tutor profile', (await p.locator('[data-tutor-doc]').count()) === 1 && /Omar CV\.pdf/.test(await p.innerText('body')));
  check('The unshared document stays hidden', !/Private grades/.test(await p.innerText('body')));
  r = await p.request.get(`${BASE}/api/tutor-doc/00000000-0000-0000-0000-00000000d001`, { maxRedirects: 0 });
  check('Students can open the shared CV', r.status() === 302 && /token=/.test(r.headers()['location'] || ''), 'status ' + r.status());
  r = await p.request.get(`${BASE}/api/tutor-doc/00000000-0000-0000-0000-00000000d002`, { maxRedirects: 0 });
  check('The unshared document still cannot be opened', r.status() === 404, 'status ' + r.status());

  // review box on the profile after a finished session
  q(`insert into public.tutoring_requests (id, school_id, learner_id, tutor_id, subject, status) values ('00000000-0000-0000-0000-00000000e0b1','${SCHOOL}','${LAYLA}','${OMAR}','Math','completed')`);
  await p.goto(`${BASE}/tutors/${OMAR}`, { waitUntil: 'networkidle' });
  check('After a finished session the profile offers a review', (await p.locator('[data-review-form]').count()) === 1);
  await p.locator('[data-review-form] [role=radio]').nth(3).click();
  await p.fill('[data-review-form] textarea', 'Clear and patient.');
  await p.getByRole('button', { name: 'Send review' }).click();
  await p.waitForTimeout(1500);
  check('The review is saved', q(`select count(*) from public.tutor_reviews where tutor_id='${OMAR}' and rating=4`) === '1');
  await layla.ctx.close();

  // the tutor sees themselves in the directory and can manage sharing
  const omar = await login(b, 'demo.omar@pioneers.edu.ps');
  p = omar.p;
  await p.goto(`${BASE}/tutors`, { waitUntil: 'networkidle' });
  check('A tutor sees their own card in the directory', (await p.locator(`[data-tutor="${OMAR}"]`).count()) === 1);
  await p.goto(`${BASE}/tutors/me`, { waitUntil: 'networkidle' });
  check('My tutor profile lists my documents with a share toggle', (await p.locator('[data-my-documents] [data-share-doc]').count()) === 2);
  await p.locator('[data-my-documents] li', { hasText: 'Private grades' }).locator('[data-share-doc]').click();
  await p.waitForTimeout(1200);
  check('A tutor can share a document', q(`select public_on_profile from public.tutor_application_documents where id='00000000-0000-0000-0000-00000000d002'`) === 't');
  await omar.ctx.close();

  q(`delete from public.tutor_application_documents where profile_id='${OMAR}'; delete from public.tutor_applications where profile_id='${OMAR}'; delete from public.tutor_reviews where tutor_id='${OMAR}'; delete from public.tutoring_requests where tutor_id='${OMAR}'`);
  await b.close();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
