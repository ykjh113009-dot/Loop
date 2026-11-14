# Phase 2: core platform

## What was added

| Area | What students get |
| --- | --- |
| Profiles | Photo, cover photo, @handle, class letter, skills, favourite subjects, accent colour, leadership roles, friends / followers / following counts, their own posts |
| Settings (`/settings`) | Language (English / Arabic), who can message you, notifications on/off, larger text, reduce motion, blocked list, security link, deactivate account, delete account |
| Connections | Follow (immediate), friend requests (accept / decline / cancel), unfriend, lists of friends, followers and following, `/friends` |
| Feed (`/community`, Home) | School-wide or club posts; kinds: post, photo, question, achievement, poll, shared post; reactions (6), comments and replies, saves (`/saved`), #hashtags, @mentions, trending tags, reporting of posts and comments |
| Chats | Group chats, message requests, photos / files / voice messages / short videos (10 MB), message reactions |
| Notifications | New kinds: reaction, comment, reply, mention, share, follow, friend request, message request, group added. A global on/off switch |
| Languages | Arabic with right-to-left layout for the shell, Home, feed, profiles, friends, settings and chats |

## How the feed is ranked (`feed_posts`)

```
score = 2 x ln(1 + reactions + 2 x comments)      engagement
      + friend 4 | someone you follow 3 | you 1   people you know
      + 2 if it is in one of your clubs
      + 3 during the first 6 hours                 new posts always get a turn
      - 1 for every 12 hours of age
```
Posts from people you blocked (or who blocked you) never appear. Club posts only appear for members.

## Notifications switch

With notifications off, entries are still written (so the activity is there when the student opens Loop)
but they are marked `silent`: nothing is pushed and the bell counter ignores them.

## Messaging privacy

`profile_settings.who_can_message`:
- `everyone`: any current student can start a chat.
- `friends`: a non-friend's first message becomes a **message request**. They can send one message, then must wait. The receiver accepts or declines.
- `nobody`: new chats are refused.

Group chats: the creator can add friends, and students who accept messages from everyone. Others are skipped.

## Accounts

- **Deactivate**: hides the profile and posts; the student can reactivate from the "account paused" page.
- **Delete**: needs the word DELETE, no admin approval. Removes the account and everything it owns
  (posts, comments, messages, points). The activity log keeps one line without the name.
  The platform owner cannot delete or deactivate their account.

## Adding or fixing a translation

Text in the code is written in English: `t("Save settings")`.
Arabic lives in `lib/i18n-ar.ts` as `"Save settings": "حفظ الإعدادات"`. Anything missing falls back to English.
Server pages use `const { t, locale } = await getT()`; client components receive `locale` and call `makeT(locale)`.
Layout uses direction-neutral classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), so it mirrors by itself.

## Not finished in this phase (honest list)

| Item | State |
| --- | --- |
| Arabic text on older pages (clubs, events, market, tutors, council, admin, moderation, login) | Layout is right-to-left, text is still English |
| Stories and short videos in the feed | Not built. Photos, polls and shared posts are. Videos work in chats only |
| Profile photos | Shown on the profile page. Elsewhere the illustrated avatar is still used |
| Personal portfolio and academic achievements on the profile | Phase 5 (LOOP Passport) |
| Interest-based ranking and interaction history in the feed | Ranking uses friends, follows, clubs, engagement and freshness |
| Per-type notification preferences | Only the global switch |
| Renaming a group, removing a member | Only create, add and leave |
| Mentions use the @handle from the school email | No pick-list while typing |
