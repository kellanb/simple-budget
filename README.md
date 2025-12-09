# Cash Flow Forecaster

Mobile-first cash flow planner built with Next.js 16, Tailwind v4, Shadcn-inspired UI, Convex (schema + functions), and @dnd-kit for ordering.

## Quick start

1) Install deps
```bash
npm install
```

2) Configure Convex (needs interactive auth with your Convex account)
```bash
# set your Convex deployment URL in .env.local
echo 'NEXT_PUBLIC_CONVEX_URL=<your_convex_url>' > .env.local

# then configure Convex (will prompt)
npx convex dev
```
This creates `convex.json`, generates `_generated/*`, and starts the dev backend.

3) Run Next.js
```bash
npm run dev
```

## What’s included
- Auth: email/password prototype stored in Convex (`convex/auth.ts` + `sessions` table).
- Schema: `users`, `sessions`, `months`, `transactions` with savings fields and recurring/template flags.
- Core UI: mobile-first sticky header with current/projected balances, month selector, add/edit transaction sheet, new month wizard, drag-and-drop ordering, paid toggles, savings percentage mode.
- Utilities: balance calculator (`src/lib/balances.ts`) with dynamic savings resolution.

## Notes
- The Convex CLI must run once to generate typed clients; the repo ships with lightweight stubs so the UI compiles, but real data needs `npx convex dev`.
- Set `NEXT_PUBLIC_CONVEX_URL` to your dev deployment (from Convex dashboard or `convex dev` output).
- Tailwind is v4 CSS-first; UI primitives live in `src/components/ui`.
