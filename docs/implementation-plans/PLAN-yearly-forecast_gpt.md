---
name: Yearly Forecast UI
overview: Add a new mobile-first `/yearly` page that mirrors the Google Sheet structure with fixed top-level sections, plus user-created draggable subsections and draggable line items persisted in Convex (no Google Sheet import/sync).
todos:
  - id: schema-yearly-tables
    content: Add `yearlySubsections` + `yearlyLineItems` tables and indexes in `convex/schema.ts`.
    status: pending
  - id: convex-yearly-api
    content: Create `convex/yearly.ts` with list/create/update/remove/reorder/move functions using `requireSession`.
    status: pending
  - id: yearly-route-ui
    content: Create `src/app/yearly/page.tsx` that loads Yearly data for selected year and renders fixed sections.
    status: pending
  - id: yearly-components-dnd
    content: Implement yearly section/subsection/line-item components with nested `@dnd-kit` drag and optimistic local state updates.
    status: pending
  - id: polish-mobile-style
    content: Match Monthly Forecast styling (cards, spacing, handles), add totals, and ensure good mobile ergonomics.
    status: pending
---

# Yearly Forecast (mobile web) — fixed sections + draggable subsections/items

### Goals
- Build a new **mobile-optimized** Yearly Forecast route at `/yearly`.
- Keep **top-level sections fixed** (e.g. Income Summary, Monthly Bills, Non‑Monthly Bills, etc.).
- Inside each fixed section, allow users to **add / rename / delete / drag‑reorder subsections**.
- Inside subsections, allow users to **add / edit / delete / drag‑reorder line items**, and drag items between subsections.
- Match the Monthly Forecast look/feel (cards, typography, spacing, drag handle interaction) but allow layout tweaks that make sense for a yearly view.
- Persist all Yearly Forecast state in **Convex per user (and per year)**.

### What we’ll reuse
- **Auth + token** pattern from `[src/components/auth/auth-context.tsx](src/components/auth/auth-context.tsx)` and existing Convex functions (all Yearly APIs will accept `{ token, year, ... }`).
- **Drag/reorder UX** from Monthly Forecast in `[src/app/page.tsx](src/app/page.tsx)` (optimistic `arrayMove` + server reorder), e.g.

```ts
const reordered = arrayMove(list, oldIndex, newIndex);
setLocalState(reordered);
await reorderMutation({ token: user.token, ..., orderedIds: reordered.map(x => x._id) });
```

### Data model (Convex)
Add two new tables to `[convex/schema.ts](convex/schema.ts)` (top-level sections remain code-defined constants):
- **`yearlySubsections`**
  - `userId: Id<"users">`, `year: number`, `sectionKey: string`, `title: string`, `order: number`
  - Indexes:
    - `by_user_and_year_and_sectionKey_and_order: ["userId","year","sectionKey","order"]`
    - `by_user_and_year_and_sectionKey: ["userId","year","sectionKey"]` (for max-order lookups)
- **`yearlyLineItems`**
  - `userId`, `year`, `sectionKey`, `subsectionId: Id<"yearlySubsections">`, `label: string`, `amountCents: number`, `order: number`, optional `note?: string`
  - Indexes:
    - `by_subsection_and_order: ["subsectionId","order"]`
    - `by_user_and_year: ["userId","year"]` (for cleanup / future totals)

Top-level fixed sections will be defined in code as:
- `const YEARLY_SECTION_DEFS = [{ key, title, description? }, ...] as const;`

### Convex API (new file)
Create `[convex/yearly.ts](convex/yearly.ts)` implementing:
- **Query** `listForYear` → returns fixed sections with nested subsections + items, ordered.
- **Mutations**
  - `createSubsection({ token, year, sectionKey, title })`
  - `updateSubsection({ token, subsectionId, patch: { title? } })`
  - `removeSubsection({ token, subsectionId })` (also deletes its items)
  - `reorderSubsections({ token, year, sectionKey, orderedIds })` (sets `order = i` like `[convex/transactions.ts](convex/transactions.ts)`)
  - `createLineItem({ token, year, sectionKey, subsectionId, label, amountCents })`
  - `updateLineItem({ token, lineItemId, patch: { label?, amountCents?, note? } })`
  - `removeLineItem({ token, lineItemId })`
  - `reorderLineItems({ token, subsectionId, orderedIds })`
  - `moveLineItem({ token, lineItemId, toSubsectionId, toSectionKey, sourceOrderedIds, destOrderedIds })`

All functions will:
- Use `requireSession(ctx, token)` from `[convex/utils.ts](convex/utils.ts)`.
- Use indexes (no `.filter`).

### UI / Route implementation
Create `[src/app/yearly/page.tsx](src/app/yearly/page.tsx)` (client component) that:
- Renders the same `Navbar` as Monthly Forecast and sets `Yearly Forecast` active.
- Provides a **year selector** (default current year; easy to extend) and loads data via `useQuery(api.yearly.listForYear, { token, year })`.
- Displays each fixed section as a `Card` with:
  - Section header (title + section total)
  - Subsections list (sortable)
  - “Add subsection” action

Add new UI components under `[src/components/yearly/](src/components/yearly/)`:
- `YearlySectionCard` (renders one fixed section)
- `YearlySubsection` (editable title + drag handle + delete)
- `YearlyLineItemRow` (editable label/amount + drag handle + delete)

### Drag & drop behavior (dnd-kit)
Use `@dnd-kit` (already in `package.json`) with a **two-level sortable setup**:
- Sortable subsections within a given section.
- Sortable line items within (and between) subsections.

Implementation details:
- Use a single `DndContext` with `PointerSensor({ activationConstraint: { distance: 8 } })` to match Monthly Forecast feel.
- Use `data` on `useSortable` to tag draggable type (`"subsection" | "lineItem"`) and current container.
- On drag end:
  - Update local optimistic state (`arrayMove` for same container; custom move for cross-container).
  - Call the appropriate Convex mutation (`reorderSubsections`, `reorderLineItems`, or `moveLineItem`).

### Styling / Mobile UX
- Follow the spacing + max width convention from Monthly page (`max-w-3xl`, `px-4`).
- Subsections collapse/expand on mobile (optional v1), but always keep drag handles reachable.
- Inline editing with the existing `[src/components/ui/input.tsx](src/components/ui/input.tsx)` and lightweight “Edit” affordances.

### Integration points
- Monthly page already links to `/yearly` via navbar items in `[src/app/page.tsx](src/app/page.tsx)`; once `[src/app/yearly/page.tsx](src/app/yearly/page.tsx)` exists, navigation will work.
- Optional small cleanup: create a tiny helper like `getNavItems(pathname)` so Monthly + Yearly don’t duplicate nav configuration.

### Manual test plan
- Sign in → navigate to `/yearly`.
- Add subsections under each fixed section.
- Add line items and edit label/amount.
- Drag reorder:
  - Subsections within a section.
  - Line items within a subsection.
  - Move line items across subsections.
- Refresh page → verify data + ordering persist.
