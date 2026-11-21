# Postponed features

University & Opportunities, Mentorship, the Tawjihi corner, Skill Exchange, Loop Magazine and the Digital Yearbook are postponed for a future version of Loop.
Their pages are kept here, in a private folder (a folder starting with `_` is never a route), so nothing is
rebuilt later. Their database tables, records and server actions are untouched.

To bring one back:
1. Move its folder from `_postponed/` back to `app/(main)/`.
2. Add its item to the Learning Hub (or another category) in `lib/nav.ts`.
3. Remove its line from `redirects()` in `next.config.ts`.



## Reward Shop (spending points)

The whole redeem experience is kept in `rewards-redeem/`: the shop page (`reward-shop-page.tsx`), the confirmation button (`redeem-button.tsx`) and the admin tools for rewards, pictures and hand-overs (`admin-rewards-page.tsx`, `reward-forms.tsx`). The database (`rewards`, `reward_redemptions`, categories) and the `redeemReward` / `handleRedemption` / `updateReward` actions are untouched. `/shop` shows Coming soon for the shop part and keeps the live Top 10 Prizes beside it (each prize goes to that place on the leaderboard).
To bring it back: merge the reward grid from `reward-shop-page.tsx` into `app/(main)/shop/page.tsx` in place of the Coming soon card, `admin-rewards-page.tsx` over `app/(main)/admin/rewards/page.tsx` (and move `reward-forms.tsx` next to it, `redeem-button.tsx` next to the shop page), and remove `soon: true` from the Reward Shop item in `lib/nav.ts`.
