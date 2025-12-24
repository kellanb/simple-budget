# SIMPLE BUDGET

Mobile-first cash flow planner built with Next.js 16, Tailwind v4, Shadcn-inspired UI, Convex (schema + functions), and @dnd-kit for ordering.

## Quick start

1) Install deps
```bash
npm install
```

2) Configure Convex (needs interactive auth with your Convex account)
```bash
# configure Convex (will prompt)
npx convex dev
```
This creates `convex.json`, generates `_generated/*`, and starts the dev backend.

Then set your Convex URL for the frontend in `.env.local`:
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

3) Run Next.js
```bash
npm run dev
```

## What’s included
- Auth: email/password prototype stored in Convex (`convex/auth.ts` + `sessions` table).
- Schema: `users`, `sessions`, `months`, `transactions` with savings fields and recurring/template flags.
- Core UI: mobile-first sticky header with current/projected balances, month selector, add/edit transaction sheet, new month wizard, drag-and-drop ordering, paid toggles, savings percentage mode.
- Utilities: balance calculator (`src/lib/balances.ts`) with dynamic savings resolution.

## Deployment

This project uses a unified deployment pipeline:

### Frontend (Vercel)
- **Automatic**: Vercel is connected to this repo and auto-deploys from `main`.
- Pushes or merges to `main` trigger a new Vercel production deployment.

### Backend (Convex)
- **Production**: A GitHub Action (`.github/workflows/convex-deploy.yml`) runs `npx convex deploy` on pushes to `main`, deploying the Convex backend to production.
- **Development**: Run `npx convex dev` locally to sync changes to your Convex dev deployment in real-time as you edit files in `convex/`.

### Manual redeploy
- Use the "Run workflow" button on the GitHub Actions page to manually trigger a Convex production deploy via `workflow_dispatch`.

## Notes
- The Convex CLI must run once to generate typed clients; the repo ships with lightweight stubs so the UI compiles, but real data needs `npx convex dev`.
- `NEXT_PUBLIC_CONVEX_URL` is required; set it to your dev deployment (from Convex dashboard or `convex dev` output).
- Tailwind is v4 CSS-first; UI primitives live in `src/components/ui`.
