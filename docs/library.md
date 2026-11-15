# Academic Resources Library

One digital library inside **Academic Resources** (sidebar → Academic Resources). It replaces the old link-only list; any link that was
already there was carried over as an Official resource.

## What students see
| Page | Route |
|---|---|
| Home: search, Suggest a Resource, Browse by Subject, Top rated, Recently added | `/academic-resources` (`?q=` searches titles, descriptions, authors and subject names) |
| Subject page (Newest / Top rated / Most viewed) | `/academic-resources/[slug]` |
| Resource page: details, Read in Loop, Download, Open Resource, Save, ratings and reviews | `/academic-resources/resource/[id]` |
| PDF / image reader | `/academic-resources/resource/[id]/read` |
| Suggest a Resource (with a summary step and drafts) | `/academic-resources/suggest` |
| Edit, resubmit | `/academic-resources/resource/[id]/edit` |
| My Library (saved, private) | `/academic-resources/my-library` |
| My Contributions (Draft / Pending / Approved / Rejected, feedback, points) | `/academic-resources/my-contributions` |
| Review dashboard (Council + admins) | `/academic-resources/review`, `/review/[id]` |
| Manage library (admins: Official resources and the points setting) | `/academic-resources/manage` |

## Rules
- **Who can share:** verified students, approved tutors, school staff, Council members and admins (`can_submit_library()`).
- **Who reviews:** Student Council members and admins only (`can_review_library()`). Nobody can review their own submission.
- **Official** resources are added by admins directly (no review) and carry the Official label; **Community** resources carry the Community label and show the submitter.
- **Versions:** every submission or edit is a *revision*. The approved version stays public until a newer one is approved. A rejected update changes nothing; the owner sees the reason and can edit and resubmit. Deleting hides a resource from browsing but keeps its history for reviewers.
- **Points:** a fixed amount (default 10, admins change it in Manage library) through the existing points ledger, once per resource. The ledger key is based on the content, so deleting and sharing the same file or link again earns nothing, and edits never earn more.
- **Ratings:** one 1–5 star rating per person per resource (changeable, removable), optional written review, no replies or comments. You cannot rate your own resource. *Top rated* uses a Bayesian average (`library_top_rated`) so a single 5-star vote does not beat many good ones.
- **Statistics:** a view counts once per person per 6 hours (and not for the owner); a download once per person per day and only when the file link was really produced. Refreshing does not add views.
- **Flags:** only the Council and admins can flag a published resource, with an internal reason. They then keep, hide or remove it; every action is kept in an internal record that ordinary users cannot read. There is no public report button.
- **Notifications:** new submission (reviewers), approved, rejected with reason, points earned, update approved or rejected.

## Security
- All tables are read-only for signed-in users (`revoke insert, update, delete`); every change is a database function that checks who is calling.
- Files live in the **private** bucket `library-files` (`<school>/<user>/<uuid>/<file>`, 25 MB, PDF, Word, PowerPoint, Excel, text, images). Pending files can only be read by the owner and reviewers. The private storage path column is not readable by the app (column-level grant); files are served by `/api/library/[id]/file`, which asks the database (`library_file_info`) whether the caller may have the file, creates a 2-minute signed link, and only then records a download.
- Links must be normal `http(s)` addresses with a real host name (no IP addresses, localhost, logins or scripts) and open with `rel="noopener noreferrer nofollow"`.
- Duplicate files/links are refused (hash or normalised link); submissions are rate limited; the content filter runs on titles, descriptions and notes.

## Files
Migration `supabase/migrations/20261119000001_academic_library.sql`; actions `app/actions/library.ts`; route `app/api/library/[id]/file/route.ts`; components `components/library/*`; pages `app/(main)/academic-resources/**`; tests `supabase/tests/library.sql`, `tests/e2e/library.js`.

## Known limits
- Files are not scanned for malware (type and size are checked; Word/PowerPoint/Excel files are download-only, only PDFs and images open in the reader).
- Replaced or removed files stay in storage (nothing is deleted automatically).
- Page titles in the header stay English in Arabic mode.
