## Codebase Review (2025-12-23)

Actionable notes to revisit and fix current issues before commit/deploy.

### Lint/Stability
- `src/app/page.tsx`: `react-hooks/set-state-in-effect` errors for state updates inside effects (projection cache, local transactions sync, month picker temp state). Refactor to derive state from props/data or move state updates into event handlers/memos; avoid synchronous setState in effects.
- `src/components/theme/theme-context.tsx`: Same lint error for `setMounted` inside `useEffect`; consider initializing via `useState` with lazy init or guard rendering differently.
- `src/app/page.tsx`: Remove unused import `ScrollArea`.
- `convex/_generated/*`: Warnings for unused `eslint-disable` directives; either adjust lint ignore patterns or remove directives in generated files.

### Security/Backend
- `convex/auth.ts`: Password hashing uses single SHA-256 + salt. Replace with stronger KDF (e.g., bcrypt/argon2id/PBKDF2) to mitigate brute-force risk.

### Configuration/Console Noise
- `src/app/providers.tsx`: Falls back to `http://localhost:3000` when `NEXT_PUBLIC_CONVEX_URL` is missing, causing runtime console warnings and Convex connection failures (Convex dev defaults to 4000). Set `NEXT_PUBLIC_CONVEX_URL` in `.env.local` (e.g., dev deployment URL) or change fallback to the Convex dev port.

### Next Steps Checklist
- [ ] Fix state-in-effect lint errors in `src/app/page.tsx` (projection cache, local sync, month picker) and `src/components/theme/theme-context.tsx`.
- [ ] Remove unused `ScrollArea` import from `src/app/page.tsx`.
- [ ] Decide how to handle generated-file lint warnings (ignore or clean directives).
- [ ] Swap auth hashing to a proper KDF (bcrypt/argon2id/PBKDF2) and add migration plan for existing hashes if any.
- [ ] Configure `NEXT_PUBLIC_CONVEX_URL` (or adjust fallback URL) to stop Convex client warnings and connection errors.

