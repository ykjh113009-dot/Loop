# Postponed features

University & Opportunities, Mentorship and the Tawjihi corner are postponed for a future version of Loop.
Their pages are kept here, in a private folder (a folder starting with `_` is never a route), so nothing is
rebuilt later. Their database tables, records and server actions are untouched.

To bring one back:
1. Move its folder from `_postponed/` back to `app/(main)/`.
2. Add its item to the Learning Hub (or another category) in `lib/nav.ts`.
3. Remove its line from `redirects()` in `next.config.ts`.
