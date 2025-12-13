# Yearly Forecast Agent Plans Analysis

This document analyzes and compares the four candidate plans:

- `PLAN-yearly-forecast_gpt.md`
- `PLAN-yearly-forecast_opus.md`
- `PLAN-yearly-forecast_gemini.md`
- `PLAN-yearly-forecast_droid.md`

Goal: identify the best plan *as-is* and recommend a combined plan that best fits this repo’s existing architecture (Next.js App Router, Convex backend, `requireSession` auth, and `@dnd-kit` patterns already used on the Monthly Forecast page).

---

## 1. Quick context: what “fit” means for this repo

Based on the current codebase:

- **Auth** is token-based via Convex sessions and `requireSession(ctx, token)` (`convex/utils.ts`).
- **Reordering** is done by patching `order` fields with a mutation that loops over `orderedIds` (see `convex/transactions.ts`, `reorder`).
- The **Monthly Forecast UI** is a single-page, mobile-first layout with:
  - `Navbar` items configured per-page
  - optimistic local state (e.g. `localTransactions`) updated immediately, then persisted
  - `@dnd-kit` with `PointerSensor({ activationConstraint: { distance: 8 } })` for touch-friendly dragging

So the best yearly plan should:

- match that token + Convex mutation/query style
- keep schema simple and indexed (avoid heavy filtering)
- adopt a similar DnD + optimistic update approach

---

## 2. Per-plan summaries

### 2.1 GPT plan (`PLAN-yearly-forecast_gpt.md`)

- **Intent & scope**
  - Add `/yearly` with fixed top-level sections.
  - Allow user-created subsections inside each section.
  - Allow line items inside subsections.
  - Persist everything in Convex per user/year.
  - Implement nested drag-and-drop (subsections and line items), including cross-subsection moves.

- **Data model**
  - Two tables:
    - `yearlySubsections`: `{ userId, year, sectionKey, title, order }`
    - `yearlyLineItems`: `{ userId, year, sectionKey, subsectionId, label, amountCents, order, note? }`
  - Fixed top-level sections are code constants.

- **Backend / API shape**
  - `listForYear` query returns fixed sections with nested subsections + items.
  - Mutations for CRUD, reorder, and `moveLineItem`.
  - Uses `requireSession` and index-based queries.

- **Frontend / UX**
  - `/yearly` page mirrors Monthly Forecast layout.
  - Components: section card, subsection, line item row.
  - DnD: one `DndContext`, two sortable layers, optimistic local updates.

- **Notable strengths**
  - Best alignment with existing repo patterns (auth, reorder loops, DnD configuration).
  - Minimal schema (easy to ship and iterate).
  - Explicit about indexes and avoiding server-side `.filter` patterns.

- **Notable weaknesses / risks**
  - Leaves some “budget semantics” underspecified (e.g. non-monthly normalization, “After X” income ladder, richer debt/savings fields).
  - Only includes `note?` in the base item model (might require later schema edits to support richer UI).

---

### 2.2 Opus plan (`PLAN-yearly-forecast_opus.md`)

- **Intent & scope**
  - Same goal: yearly budget page with fixed main sections, draggable subsections, draggable items.
  - Strong emphasis on UI/UX structure and explicit calculations.

- **Data model**
  - More complex hierarchy:
    - `yearlyForecasts` root per `{userId, year}`
    - `yearlySubsections` and `yearlyItems` reference the root
  - Items may optionally live “directly under section” via optional `subsectionId`.
  - Many optional fields depending on section type (debt/savings details, due date, payment source).

- **Backend / API shape**
  - Introduces `getOrCreateForecast` lifecycle pattern.
  - Separate list queries for subsections and items.
  - More “domain-driven” API surface.

- **Frontend / UX**
  - Detailed component tree and bottom-sheet editing.
  - Collapsible section cards and mobile niceties.
  - Explicit “Income Summary” component and `yearly-calculations.ts` module.

- **Notable strengths**
  - Best at describing *what the UI should feel like*.
  - Best at “derived values”: totals, percent of income, and “After X” ladder.
  - The optional fields are realistic for debts/savings (useful roadmap).

- **Notable weaknesses / risks**
  - Adds structural complexity (root forecast table) that isn’t strictly needed given the repo’s existing patterns.
  - Allowing items without subsections adds edge cases for DnD/UI and querying.

---

### 2.3 Gemini plan (`PLAN-yearly-forecast_gemini.md`)

- **Intent & scope**
  - Build a yearly budget route with sections/subsections/items and DnD.

- **Data model**
  - Heavier model:
    - `yearly_budgets` root
    - `budget_subsections`
    - `budget_items` with many optional fields

- **Backend / API shape**
  - General CRUD and reorder items/subsections.

- **Frontend / UX**
  - Mentions mobile cards, collapsible/accordion layout, and two-level DnD.

- **Notable strengths**
  - Section-specific item fields are acknowledged.

- **Notable weaknesses / risks**
  - Lowest alignment with the repo’s current “lean tables + token-based operations” approach.
  - Root budget table increases complexity without clear V1 payoff.
  - Lacks the stronger Convex index/ownership details present in GPT.

---

### 2.4 Droid plan (`PLAN-yearly-forecast_droid.md`)

- **Intent & scope**
  - Similar to GPT, but explicitly positions itself as a “combined spec” with richer fields.
  - Emphasizes normalization for non-monthly bills.

- **Data model**
  - Similar to GPT’s approach (subsections + items), with an expanded set of optional fields:
    - `frequency` + `originalAmountCents` for non-monthly schedules
    - optional debt/savings/investments fields

- **Backend / API shape**
  - Follows GPT-style CRUD/reorder/move.

- **Frontend / UX**
  - Closely follows GPT layout but calls out Opus/Gemini UX ideas:
    - collapsible sections
    - sheet/dialog editors

- **Notable strengths**
  - Best “bridge plan”: keeps GPT’s simplicity while making room for richer real-world fields.
  - Calls out a small calculations module and normalization.

- **Notable weaknesses / risks**
  - As written, it’s more a “spec blend” than a strict implementation guide; you still need to choose exact V1 scope.

---

## 3. Cross-plan comparison (where they agree / differ)

### 3.1 Schema shape
- **Lean / best fit**: GPT + Droid (2 tables keyed by `{userId, year, sectionKey}` with ordering).
- **Heavier**: Opus + Gemini (root forecast/budget table + child tables).

For this repo, the lean schema is the best fit because:
- it matches how Monthly Forecast stores “just enough” structure
- it reduces query/mutation surface area and edge cases

### 3.2 Convex API design
- **GPT/Droid**: direct CRUD + reorder + move, token in every call, aligns with `convex/transactions.ts` style.
- **Opus**: lifecycle-based `getOrCreateForecast` and multiple queries.

Given your existing Convex code, GPT/Droid’s API surface is the most consistent and easiest to implement correctly.

### 3.3 UI architecture
All plans converge on:
- fixed sections
- draggable subsections within each section
- draggable items within each subsection

Differences:
- Opus provides the strongest component breakdown and mobile UX suggestions.
- GPT provides the strongest “mirror Monthly Forecast patterns” guidance.

### 3.4 DnD complexity vs value
- **V1-high-value**: reorder within container and cross-subsection move within same section.
- **Higher-risk**: allowing items without subsections (Opus) or cross-section moves (not required and adds constraints/edge cases).

### 3.5 Calculations (“totals” and “After X”)
- Opus and Droid explicitly call for a calculations module.
- GPT acknowledges totals but doesn’t specify them as clearly.

Given the spreadsheet-like goal, adding a dedicated calculation module is worth it, but can come after the basic CRUD + DnD scaffold.

---

## 4. Recommended base plan (best single plan as-is)

**Best single backbone: `PLAN-yearly-forecast_gpt.md`.**

Why:
- Matches existing repo patterns (token auth, reorder loops, DnD sensor configuration).
- Minimal schema and clear Convex indices.
- Explicit about optimistic UI + server persistence (like Monthly Forecast).

---

## 5. Suggested combined / improved plan (recommended direction)

Use **GPT as the backbone**, then selectively add:

### 5.1 Data model improvements (from Droid/Opus)
Keep GPT’s two tables, but enrich `yearlyLineItems` with a small set of optional fields that unlock real budget display needs:
- **Non-monthly normalization**
  - `frequency?: monthly | quarterly | biannual | annual | oneOff`
  - `originalAmountCents?: number`
  - Keep `amountCents` as the canonical *monthly* amount for totals.
- **Display fields**
  - `dueDate?: string` (freeform is fine)
  - `paymentSource?: string`
  - `note?: string`
- **Future-friendly fields (optional, can be UI-hidden in V1)**
  - debt: `balanceCents`, `interestRate`
  - savings: `goalAmountCents`, `currentAmountCents`, `startMonth`, `endMonth`

This keeps the DB lean while avoiding immediate schema churn later.

### 5.2 Convex API (mostly GPT)
Stick to GPT’s:
- `listForYear`
- subsection CRUD + reorder
- line item CRUD + reorder
- `moveLineItem` for cross-subsection moves

Keep the “forecast root table” concept out of V1; you can add it later if you find you need budget-level metadata.

### 5.3 Calculations module (from Opus/Droid)
Add `src/lib/yearly-calculations.ts` to centralize:
- section/subsection totals
- percent-of-income math
- “After X” ladder (Income Summary)
- monthly equivalent logic for non-monthly items

This prevents UI components from duplicating math and makes the totals consistent.

### 5.4 UI/UX (GPT layout + Opus polish)
- Match Monthly Forecast spacing, card styles, and touch targets.
- Use sheets for add/edit forms (you already have a strong pattern with `TransactionFormSheet`).
- Consider collapsible sections/subsections as a follow-on polish step.

---

## 6. Phased implementation suggestion (high-level, no code)

- **Phase 1: Foundation**
  - Schema (2 tables + indexes)
  - `convex/yearly.ts` query/mutations
  - `/yearly` route shell + basic rendering

- **Phase 2: Interactivity**
  - Add/edit/delete subsections and items via sheets
  - DnD reorder within subsection + reorder subsections
  - Cross-subsection move within same section

- **Phase 3: Spreadsheet fidelity**
  - Add totals, percent-of-income labels
  - Add “Income Summary / After X” ladder using a calculations helper
  - Add non-monthly original-vs-monthly display

- **Phase 4: Optional richness**
  - Surface debt/savings/investments extra fields
  - Collapsible sections, additional mobile ergonomics

---

## 7. Direct answer to the original prompt

- **Best plan as-is**: **GPT** is the best starting plan because it’s the most aligned with your existing app patterns and keeps the schema/API simple.
- **Best overall approach**: a **combined plan** is meaningfully better:
  - GPT provides the best backbone (schema/API/DnD alignment).
  - Droid contributes practical normalization fields for non-monthly items.
  - Opus contributes the strongest calculations + Income Summary breakdown and UI polish ideas.
  - Gemini adds little beyond what’s already covered and is less aligned due to heavier schema.
