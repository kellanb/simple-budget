## Codebase Remediation Plan (2025-12-24)

Actionable plan with decisions finalized for implementation.

---

## Priority Summary

| Priority | Issue | File | Effort |
|----------|-------|------|--------|
| 🔴 Critical | Move password hashing to PBKDF2 | `convex/auth.ts` | Medium |
| 🟡 Medium | Remove unused `ScrollArea` import | `src/app/page.tsx` | Trivial |
| 🟡 Medium | Replace `localTransactions` derived-state pattern | `src/app/page.tsx` | Medium |
| 🟢 Low | Theme hydration cleanup | `src/components/theme/theme-context.tsx` | Low |
| 🟢 Low | Projection cache refactor | `src/app/page.tsx` | Medium |
| 🟢 Low | Optimistic reorder rollback on failure | `src/app/page.tsx` | Low |
| 🟢 Low | Clear stale auth token on invalid session | `src/components/auth/auth-context.tsx` | Low |
| 🟢 Low | Generated file lint warnings | `convex/_generated/*` | Config |
| ⚪ Info | Convex URL fallback mismatch | `src/app/providers.tsx` | Trivial |

---

## 1. Security

### 1.1 Password Hashing → PBKDF2 (CRITICAL)

**Decision:** Use PBKDF2-HMAC-SHA256 with per-user salt and stored parameters.

- Parameters: iterations = **300,000** (tunable; aim for <250ms login), salt = **16 random bytes** (store as hex), output = 32-byte derived key as hex. Keep `hashVersion` to allow future upgrades.
- Storage shape (example): `{ hashVersion: 2, algo: "PBKDF2-SHA256", iterations: 300000, salt: "<hex>", hash: "<hex>" }`.
- Implementation:
  - `hashPasswordV2(password)` → generates salt, runs PBKDF2 with iterations above, returns `{ hash, salt, iterations, hashVersion: 2 }`.
  - `verifyPassword(password, stored)` → if `hashVersion === 2`, derive with stored salt/iterations and constant-time compare; if `hashVersion === 1` (old SHA-256), verify with old method (one-time), then rehash to v2 and persist.
  - Use a constant-time comparison (compare byte arrays without early return).

#### Migration (existing users)
1) Add fields to user record: `hashVersion`, `salt`, `iterations`, `hash`.  
2) On login:
   - If `hashVersion === 1`, verify with old SHA-256; if valid, immediately rehash with PBKDF2 v2 and update the record.
   - If invalid, fail normally.  
3) Optional: add a cutoff date to force reset for any remaining v1 users who never log back in.  
4) Tests: unit test hash/verify; integration test login that migrates v1 → v2; wrong password stays constant-time and fails.

---

## 2. Lint / Stability

### 2.1 Unused Import: `ScrollArea`
- **File:** `src/app/page.tsx`  
- **Fix:** Remove unused import.

### 2.2 Derived State / `set-state-in-effect`
Real-world impact: syncing server data into local state via `useEffect` adds renders and risks UI/server divergence when optimistic updates fail or responses return out of order.

- `localTransactions` sync: Replace with `optimisticReorder` state + derived `displayTransactions = optimisticReorder ?? transactions`. No sync effect needed.
- Projection cache: Use `useRef` cache (no re-render) instead of state in effects.
- Scroll/click-outside handlers: benign; if lint complains, add a one-line disable inside the handler.
- Modal/picker reset effects: Prefer keyed remount (`key` prop) or controlled state; if kept, annotate with a short eslint-disable rationale.

### 2.3 Theme Hydration
- Issue: initial render may use default theme, then flip after effect runs, causing flicker and lint noise.
- Fix: initialize theme via lazy `useState` (reads `localStorage` on first client render); keep a simple `mounted` flag if needed. `useSyncExternalStore` is an acceptable alternative.

### 2.4 Generated File Lint Warnings
- Ignore `convex/_generated/**` in ESLint (generated code).
- Flat config (`eslint.config.mjs`): `ignores: ["convex/_generated/**"]`.
- Legacy `.eslintrc*`: add to `ignorePatterns`.

### 2.5 Optimistic Reorder Rollback
- Problem: on drag/drop failure, UI keeps the unsaved order.
- Fix: capture `prev = displayTransactions`; after optimistic update, if `reorderTx` throws, restore `prev` (or refetch) and show a toast.

### 2.6 Stale Auth Token Cleanup
- Problem: when `getSession` returns `null`, token stays in memory/localStorage; app keeps sending bad token on reload.
- Fix: when session is `null`, clear token in state and `localStorage`; optionally trigger a logout/refetch to stop failing queries.

---

## 3. Configuration

### 3.1 Convex URL Fallback
- Problem: fallback to `http://localhost:3000` is wrong; Convex runs on its own URL.
- Fix: require `NEXT_PUBLIC_CONVEX_URL`; throw early if missing.
- Docs: set to the URL from `convex dev` (dev) or the Convex dashboard (prod).

---

## Implementation Checklist (ready to execute)

### Phase 1: Quick Wins
- [ ] Remove unused `ScrollArea` import (`src/app/page.tsx`).
- [ ] Require `NEXT_PUBLIC_CONVEX_URL`; throw if missing; document dev/prod values (`src/app/providers.tsx`).
- [ ] Add ESLint ignore for `convex/_generated/**` (flat vs legacy config as applicable).

### Phase 2: Lint/State Fixes
- [ ] Theme hydration: lazy initializer (or `useSyncExternalStore`) + optional mounted flag (`theme-context.tsx`).
- [ ] Refactor `localTransactions` to derived `displayTransactions` with `optimisticReorder` (`page.tsx`).
- [ ] Projection cache to `useRef` (`page.tsx`).
- [ ] Modal/picker resets: keyed remount or annotated effect (`page.tsx`).
- [ ] Scroll/click-outside handlers: keep; add targeted disable if linter trips (`page.tsx`).

### Phase 3: Security (before prod)
- [ ] Implement PBKDF2 v2 helpers (salt 16 bytes, iterations 300k, hex output) (`convex/auth.ts`).
- [ ] Add `hashVersion`, `salt`, `iterations` fields to user schema; update login flow to migrate v1 → v2 on successful login.
- [ ] Tests: hash/verify unit tests; login migration path; wrong-password constant-time failure.
- [ ] (Optional) policy: force reset for any v1 users after a cutoff date.

### Phase 4: UX/Behavior
- [ ] Add rollback/refetch + toast on reorder failure (`page.tsx`).
- [ ] Clear stale auth token when session is null (`auth-context.tsx`).

---

## Notes
- PBKDF2 iterations are tunable; 300k is the starting value—measure and adjust up if latency budget allows.
- If Argon2id becomes available in the runtime, prefer it for future `hashVersion: 3`.

