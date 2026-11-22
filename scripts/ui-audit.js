// Walks every page as a student and an admin at five screen sizes and reports console errors, failed requests, sideways scrolling,
// missing labels or alt text, heading problems and small touch targets. Needs the app on :3000 and the demo data.
// Run: node scripts/ui-audit.js   (writes /tmp/scan.json)
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const sql = (q) => execSync(`docker exec supabase_db_pbs-go psql -U postgres -At -c "${q}"`).toString().trim().split('\n')[0];
const BASE='http://localhost:3000';
const ids = {
  club: sql("select id from clubs where status='approved' limit 1"), event: sql("select id from events limit 1"),
  listing: sql("select id from listings limit 1"), group: sql("select id from groups limit 1"), post: sql("select id from posts limit 1"),
  challenge: sql("select id from challenges limit 1"), tutor: sql("select profile_id from tutor_profiles limit 1"), conv: sql("select id from conversations where kind='group' limit 1"),
  election: sql("select id from elections limit 1"), comp: sql("select id from competitions limit 1"), res: sql("select id from library_resources limit 1"),
  vol: sql("select id from volunteer_opportunities limit 1"), profile: '00000000-0000-0000-0000-0000000000a5',
};
const routes = ['/home','/community','/clubs','/clubs/new','/groups','/groups/new','/polls','/polls/new','/saved','/market','/market/new','/marketplace','/events','/events/new','/announcements','/learning-hub','/academic-resources','/academic-resources/my-library','/academic-resources/my-contributions','/academic-resources/suggest','/tutors','/tutors/apply','/tutors/me','/leaderboard','/shop','/messages','/messages/new','/notifications','/profile/edit','/settings','/security','/search','/people','/friends','/points','/passport','/more','/school-life','/campus','/council','/counselor','/volunteering','/volunteering/new','/competitions','/houses','/challenges','/challenges/new','/suggestions','/leadership','/rules','/privacy','/apply-admin',
 `/clubs/${ids.club}`,`/clubs/${ids.club}/chat`,`/clubs/${ids.club}/members`,`/clubs/${ids.club}/about`,`/clubs/${ids.club}/manage`,`/events/${ids.event}`,`/market/${ids.listing}`,`/groups/${ids.group}`,`/post/${ids.post}`,`/challenges/${ids.challenge}`,`/tutors/${ids.tutor}`,`/messages/${ids.conv}`,`/council/elections/${ids.election}`,`/competitions/${ids.comp}`,`/academic-resources/resource/${ids.res}`,`/profile/${ids.profile}`,`/profile/${ids.profile}/connections`];
const adminRoutes=['/admin','/admin/students','/admin/applications','/admin/announcements','/admin/houses','/admin/leadership','/admin/log','/admin/points','/admin/rewards','/admin/settings','/moderation','/challenges/review','/tutors/review','/academic-resources/review','/academic-resources/manage','/leadership/dashboard'];
const vps=[['desktop',1440,900],['laptop',1280,720],['tablet',768,1024],['phone',390,844],['small',360,640]];
async function login(b,email,vp){const ctx=await b.newContext({viewport:vp});const p=await ctx.newPage();await p.goto(BASE+'/login',{waitUntil:'networkidle'});await p.locator('form',{has:p.locator(`input[value="${email}"]`)}).locator('button').click();await p.waitForURL(/\/(home|application-update)/);if(/application-update/.test(p.url())){await p.locator('main button, main a.btn-primary').first().click().catch(()=>{});await p.waitForTimeout(1500);}return {ctx,p};}
(async()=>{
 const b=await chromium.launch(); const issues=[];
 const add=(role,route,vp,kind,msg)=>issues.push({role,route,vp,kind,msg});
 for (const [role,email,list] of [['student','demo.layla@pioneers.edu.ps',routes],['admin','demo.rania@pioneers.edu.ps',adminRoutes.concat(['/home','/messages','/market','/events'])]]) {
  for (const [vn,w,h] of vps) {
   if (vn!=='desktop' && vn!=='phone' && role==='admin') continue;
   const {ctx,p}=await login(b,email,{width:w,height:h});
   const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))});p.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,160)));
   const bad=[];p.on('response',r=>{if(r.status()>=400&&!/\/_next\/image|favicon/.test(r.url()))bad.push(r.status()+' '+r.url().replace(BASE,'').slice(0,90))});
   for (const route of list) {
     errs.length=0;bad.length=0;
     let resp; try{resp=await p.goto(BASE+route,{waitUntil:'networkidle',timeout:30000});}catch(e){add(role,route,vn,'timeout',e.message.slice(0,80));continue;}
     await p.waitForTimeout(250);
     if(resp&&resp.status()>=400) add(role,route,vn,'http',resp.status());
     const r=await p.evaluate((w)=>{
       const vis=(e)=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
       const name=(e)=>(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')&&'x'||e.getAttribute('title')||e.innerText||'').trim()||[...e.querySelectorAll('img[alt]')].map(i=>i.alt).join('').trim();
       const out={};
       out.overflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-w;
       out.noAlt=[...document.querySelectorAll('img:not([alt])')].filter(vis).map(i=>i.src.slice(-40));
       out.btnNoName=[...document.querySelectorAll('button,a[href],[role=button]')].filter(vis).filter(e=>!name(e)).map(e=>(e.outerHTML.slice(0,90)));
       out.inputNoLabel=[...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea')].filter(vis).filter(e=>!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.getAttribute('title')||(e.id&&document.querySelector(`label[for="${CSS.escape(e.id)}"]`))||e.closest('label'))).map(e=>e.outerHTML.slice(0,90));
       out.h1=[...document.querySelectorAll('h1')].filter(vis).length;
       out.small=[...document.querySelectorAll('button,a[href]')].filter(vis).filter(e=>{const r=e.getBoundingClientRect();return (r.width<32||r.height<32)&&!e.closest('p,li > span, nav[aria-label=breadcrumb]')&&getComputedStyle(e).display!=='inline'}).length;
       out.cut=[...document.querySelectorAll('main *')].filter(vis).filter(e=>{const r=e.getBoundingClientRect();return r.right>w+2&&getComputedStyle(e).position!=='fixed'}).length;
       out.dupId=(()=>{const m={};document.querySelectorAll('[id]').forEach(e=>m[e.id]=(m[e.id]||0)+1);return Object.keys(m).filter(k=>m[k]>1)})();
       return out;
     },w);
     if(r.overflow>0) add(role,route,vn,'h-scroll',r.overflow+'px');
     if(r.noAlt.length) add(role,route,vn,'img-no-alt',r.noAlt.join(','));
     if(r.btnNoName.length) add(role,route,vn,'no-name',r.btnNoName.slice(0,2).join(' | '));
     if(r.inputNoLabel.length) add(role,route,vn,'no-label',r.inputNoLabel.slice(0,2).join(' | '));
     if(r.h1!==1 && !/^\/(rules|privacy)/.test(route)) add(role,route,vn,'h1-count',r.h1);
     if(r.dupId.length) add(role,route,vn,'dup-id',r.dupId.join(','));
     if(vn==='phone'&&r.small>0) add(role,route,vn,'small-target',r.small);
     const e=errs.filter(x=>!/Failed to load resource/.test(x)); if(e.length) add(role,route,vn,'console',e.slice(0,2).join(' | '));
     if(bad.length) add(role,route,vn,'net',bad.slice(0,3).join(' | '));
   }
   await ctx.close();
  }
 }
 require('fs').writeFileSync('/tmp/scan.json',JSON.stringify(issues,null,1));
 console.log('issues',issues.length); await b.close();
})();
