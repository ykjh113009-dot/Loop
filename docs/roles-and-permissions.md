# Roles and permissions

Every rule below is enforced **in the database** (Row Level Security and checked functions).
The pages only hide buttons; they are never the protection.

## Account roles (`profiles.role`)

| Role | Rank | How you get it |
| --- | --- | --- |
| `student` | 0 | Sign in with a school Google account. |
| `counselor` | 0 | Set by a Super Admin (adult staff; reads the private counselor channel). |
| `moderator` | 1 | A Super Admin approves an admin application, or sets it directly. |
| `admin` | 2 | Same. |
| `super_admin` | 3 | Only the **owner** can appoint or remove Super Admins. |
| owner (`profiles.is_owner`) | 4 | One per school. Set from `admin_emails` on first sign-in. Cannot be demoted, suspended or removed from inside Loop. |

An admin acts only on accounts **below** their own rank (`can_manage_account`).

## What each role can do

| Action | Moderator | Admin | Super Admin | Owner |
| --- | :-: | :-: | :-: | :-: |
| Review, dismiss and act on reports; remove content | yes | yes | yes | yes |
| Approve clubs and events | yes | yes | yes | yes |
| Read the activity log | yes | yes | yes | yes |
| Suspend an account (1 to 365 days) and lift it | no | yes | yes | yes |
| Pause one activity (posting, commenting, messaging, creating groups, publishing) | no | yes | yes | yes |
| Change a grade, remove or restore an account, set alumni | no | yes | yes | yes |
| Publish announcements, manage the email list and blocked words | no | yes | yes | yes |
| Review leadership requests | no | yes | yes | yes |
| See admin statistics and security alerts | no | yes | yes | yes |
| Change roles (student, moderator, admin, counselor) | no | no | yes | yes |
| Read and review admin applications | no | no | yes | yes |
| Assign, change or remove a leadership role already given | no | no | yes | yes |
| Change school settings (name, grades, sign-up rule) | no | no | yes | yes |
| Reset another admin's two-step sign-in | no | no | yes | yes |
| Appoint or remove a Super Admin | no | no | no | yes |

There is no permanent ban. Passwords are never stored by Loop and nobody can see them.

## Two-step sign-in

Admins and Super Admins must pass a 6-digit authenticator code in each session
(`schools.admin_mfa_required`, on by default). Without it `is_admin()` and `is_staff()` are false,
so admin data is invisible and admin actions are refused, even through the API.
Moderators do not need it. Demo schools switch it off.

## Admin applications

1. On the sign-in page choose **Admin**, then sign in with Google.
2. Fill in the form at `/apply-admin` (name and email come from Google and cannot be edited).
3. Super Admins get a notification and review it at **Admin → Admin applications**.
4. They approve with any role (it may differ from the one requested) or reject. Nothing is granted before that.

## Student leadership roles (`leadership_roles`)

Class representative, club leader, student council member, school administration / staff.
These are extra roles on a student account, and one student can hold several.
Students ask at `/leadership`; Admins approve or reject; only Super Admins remove a role once given.
Club leaders and council members are kept in step with the club and council lists automatically.
The shared Leadership Dashboard is built in Phase 3.

## Phase 3 additions

- **School staff** (leadership role `school_staff`) can check point requests and club achievements, hand over prizes, run competitions and make official groups. They cannot manage accounts.
- **Student council members** can make official groups and answer suggestions.
- **Club leaders** manage their own club (applications, team roles, meetings, tasks, budget, resources, achievements). They cannot make other leaders or remove leaders.
- **Class representatives** announce to their own class and see its summary.
- Full table: `docs/phase3.md`.
