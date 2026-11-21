# Postponed features

Redeeming points for rewards (the Rewards Shop), University & Opportunities, Mentorship, the Tawjihi corner, Skill Exchange, Loop Magazine and the Digital Yearbook are postponed for a future version of Loop.
Their pages are kept here, in a private folder (a folder starting with `_` is never a route), so nothing is
rebuilt later. Their database tables, records and server actions are untouched.

To bring one back:
1. Move its folder from `_postponed/` back to `app/(main)/`.
2. Add its item to the Learning Hub (or another category) in `lib/nav.ts`.
3. Remove its line from `redirects()` in `next.config.ts`.


## Rewards redeem (spending points)

`rewards-redeem/rewards-shop.tsx` is the old `/shop` page (redeem tab, balance, "Your rewards") and `rewards-redeem/admin-rewards.tsx` is the old `/admin/rewards` page (hand over prizes, add rewards). Both are kept as they were. The database tables (`rewards`, `reward_redemptions`) and the `redeemReward` / `handleRedemption` actions are untouched. For now `/shop` shows only the Top 10 prizes ranking.
To bring it back: restore the redeem tab from `rewards-shop.tsx` into `app/(main)/shop/page.tsx`, restore the sections from `admin-rewards.tsx` into `app/(main)/admin/rewards/page.tsx`, and add a "Rewards Shop" item back to Marketplace in `lib/nav.ts`.
