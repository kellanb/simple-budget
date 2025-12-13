## Overview

This note compares the four Yearly Forecast plans from different agents:

- `PLAN-yearly-forecast_gpt.md`
- `PLAN-yearly-forecast_opus.md`
- `PLAN-yearly-forecast_gemini.md`
- `PLAN-yearly-forecast_droid.md`

The goal is to decide which plan is best to implement as a backbone for the Yearly Forecast feature, and where combining ideas from multiple plans produces a better overall direction.

---

## Per-plan summaries

### GPT plan

**Intent & scope**

- Add a mobile-first `/yearly` page that mirrors the Google Sheet’s structure.
- Keep top-level sections fixed in code, with user-created draggable subsections and draggable line items within each section.
- Persist all Yearly Forecast state per user and per year in Convex.

**Data model**

- Adds two tables:
  - `yearlySubsections` with `userId`, `year`, `sectionKey`, `title`, `order` and indexes by user/year/sectionKey/order.
  - `yearlyLineItems` with `userId`, `year`, `sectionKey`, `subsectionId`, `label`, `amountCents`, `order`, and optional `note`, plus indexes by subsection/order and by user/year.
- Top-level sections are *not* stored in Convex; they are code-defined constants (`YEARLY_SECTION_DEFS`).

**Backend / API shape**

- New `convex/yearly.ts` file with:
  - Query: `listForYear` that returns fixed sections with nested subsections and items in order.
  - Mutations for subsections: `createSubsection`, `updateSubsection`, `removeSubsection`, `reorderSubsections`.
  - Mutations for items: `createLineItem`, `updateLineItem`, `removeLineItem`, `reorderLineItems`, `moveLineItem`.
- All functions use `requireSession(ctx, token)` and leverage indexes instead of `.filter`.

**Frontend / UX**

- New route `src/app/yearly/page.tsx` (client component) with:
  - Navbar integration and `Yearly Forecast` active state.
  - Year selector (default current year) using `useQuery(api.yearly.listForYear, { token, year })`.
  - One card per fixed section, each with header, total, subsections list, and “Add subsection” action.
- New components under `src/components/yearly/`:
  - `YearlySectionCard`
  - `YearlySubsection`
  - `YearlyLineItemRow`

**Drag and drop**

- Uses `@dnd-kit` (already in the project) with:
  - Single `DndContext` with `PointerSensor({ activationConstraint: { distance: 8 } })`.
  - `useSortable` with `data` tagging type (`"subsection" | "lineItem"`) and container info.
  - On drag end: optimistic local `arrayMove` / custom move, then Convex mutation (`reorderSubsections`, `reorderLineItems`, or `moveLineItem`).

**Notable strengths**

- Very close to existing Monthly Forecast patterns, making it straightforward to implement and maintain.
- Minimal, clear schema with useful indexes.
- Convex API surface is focused and directly aligned with the UI.
- Strong, concrete guidance for DnD behavior and optimistic updates.

**Notable weaknesses / risks**

- Data model is fairly generic; it doesn’t explicitly support richer fields for debt, savings, or non-monthly frequency/original amounts.
- Calculations (totals, “After X” steps) are implied rather than explicitly specced.

---

### Opus plan

**Intent & scope**

- Build a `/yearly` route that replicates the Google Sheet in more detail.
- Model six fixed main sections with potentially rich, section-specific data.
- Provide an Income Summary and “After X” breakdowns with explicit calculation helpers.

**Data model**

- Adds three tables:
  - `yearlyForecasts` with `userId`, `year` (one forecast per user+year).
  - `yearlySubsections` linked to `forecastId`, `userId`, and a `section` enum (income, monthlyBills, nonMonthlyBills, debt, savings, investments).
  - `yearlyItems` linked to `forecastId`, `userId`, `subsectionId`, and the same `section` enum.
- `yearlyItems` has many optional fields for different section types: `monthlyAmountCents`, `frequency`, `dueDate`, `paymentSource`, `balanceCents`, `interestRate`, `currentAmountCents`, `goalAmountCents`, `startMonth`, `endMonth`, etc., with indexes by forecast/section and by subsection.

**Backend / API shape**

- New `convex/yearly.ts` with:
  - `getOrCreateForecast` (mutation) to manage a root forecast per user+year.
  - Queries and mutations for subsections and items (list, create, update, delete, reorder, move) scoped to a forecast.

**Frontend / UX**

- New `src/app/yearly/page.tsx` plus `src/components/yearly/` components:
  - `yearly-section.tsx` (collapsible section container).
  - `subsection.tsx` (draggable subsection with items).
  - `item-row.tsx` (row with section-specific fields).
  - `income-summary.tsx` for calculated summary.
  - `item-form-sheet.tsx` and `subsection-form-sheet.tsx` as bottom sheets for add/edit.
- Six fixed main sections with suggested default subsections for some sections.

**Drag and drop**

- Uses `@dnd-kit` with nested `SortableContext` setups similar to Monthly Forecast.
- Items dragged within and between subsections; subsections dragged within their parent section.

**Calculations**

- Explicit plan for `src/lib/yearly-calculations.ts` implementing:
  - Total income, section/subsection totals.
  - “After X” ladder (After Monthly Bills, Non-Monthly Bills, Debt, Savings, Investments).
  - Percentage of income metrics.

**Notable strengths**

- Very rich modeling of financial details and calculation flows.
- Makes calculations a first-class concern with a dedicated helper module.
- Thoughtful UI structure including summary components and bottom sheets.

**Notable weaknesses / risks**

- Higher complexity in schema (`yearlyForecasts` root, many optional fields) and API.
- Larger initial implementation surface area; might slow down a v1 focused on core UX.

---

### Gemini plan

**Intent & scope**

- Implement a Yearly Forecast with a budget root entity, subsections, and items with some section-specific metadata.
- Provide drag-and-drop subsections and items within fixed main sections.

**Data model**

- Adds three tables:
  - `yearly_budgets` with `userId`, `year`, and `name`.
  - `budget_subsections` linked to `budgetId` and `mainSection` (string enum), with `title` and `order`.
  - `budget_items` linked to `subsectionId` with `label`, `amount`, `order`, and optional fields such as `paymentSource`, `dueDate`, `balance`, `interestRate`, `goalAmount`, `currentAmount`, `startMonth`, `endMonth`.

**Backend / API shape**

- New `convex/yearly.ts` with:
  - `get` to fetch budget for a year with full hierarchy.
  - CRUD and reorder operations for subsections and items.

**Frontend / UX**

- New `src/app/yearly/page.tsx` and navbar update to link to `/yearly`.
- Components under `src/components/yearly/`:
  - `YearlyBudgetView` (main container and DnD context).
  - `BudgetMainSection`, `BudgetSubsection`, `BudgetItemCard`.
  - `EditItemSheet` and `EditSubsectionDialog`.
- Mobile-focused layout with cards, accordion-style main sections, and sticky headers as an option.

**Drag and drop**

- Uses `@dnd-kit/core` and `@dnd-kit/sortable` with subsections and items as sortables.

**Calculations**

- High-level mention of section totals, “After X” percentages, and monthly vs annual amounts but less detailed than Opus.

**Notable strengths**

- Balanced schema between minimal and fully rich.
- Clear API list for typical CRUD and reorder operations.
- Reasonable UX design that should map well to the current app.

**Notable weaknesses / risks**

- Introduces a `yearly_budgets` root table that may not be strictly necessary for v1.
- Less tightly coupled to the known Monthly Forecast implementation details than the GPT plan.

---

### Droid plan

**Intent & scope**

- Mirror the Google Sheet’s yearly budget mental model closely.
- Provide fixed main sections, draggable subsections, and line items with frequency/original vs monthly amounts.
- Keep everything mobile-first and aligned with the Monthly Forecast UX and patterns.

**Data model**

- Uses conceptual entities:
  - `YearlySection` (id, key, title, order) representing fixed sections, potentially persisted.
  - `YearlySubsection` with `sectionId`, `title`, `order`.
  - `YearlyItem` with `subsectionId`, `label`, `amountMonthly`, and optional fields like `originalAmount`, `frequency`, `scheduleDescription`, `paymentSource`, `notes`, `order`.
- Frequencies (monthly, quarterly, biAnnual, annual, oneOff) used to normalize non-monthly items.

**Backend / API shape**

- Functions such as:
  - `getYearlyForecast({ userId, year })` returning sections + subsections + items.
  - Subsection CRUD and reorder: `createSubsection`, `updateSubsectionTitle`, `deleteSubsection`, `reorderSubsections`.
  - Item upsert and delete: `upsertYearlyItem`, `deleteYearlyItem`, `reorderItems`, optional `moveItem`.
- Emphasizes optimistic updates similar to Monthly Forecast.

**Frontend / UX**

- New `/yearly` route using same layout shell as Monthly.
- Section card UI with totals and percentages, subsections with subtotals and add-item actions.
- Item rows showing normalized monthly amount and original schedule/amount microcopy.
- Inline or sheet-based editors with label, amount, frequency, schedule, payment source, and notes.

**Drag and drop**

- Reuses `@dnd-kit` patterns from Monthly with subsections and items as sortables, and optional cross-subsection moves.

**Calculations**

- Emphasizes client-side helpers for:
  - Income Summary (After Monthly Bills, After Non-Monthly Bills, After Debt, After Savings, After Investments).
  - Section totals and % of income, including non-monthly normalization.

**Notable strengths**

- Strong alignment with the Google Sheet’s structure and semantics.
- Explicit normalization of non-monthly items and focus on the “After X” story.
- Keeps UX and patterns close to the existing Monthly Forecast page.

**Notable weaknesses / risks**

- Introduces a persisted `YearlySection` concept that may not be required if sections are fixed in code.
- Less explicit about Convex indexes and exact schema definitions than the GPT plan.

---

## Cross-plan comparison

### Schema shape

- **GPT**: Minimal and focused. Only `yearlySubsections` and `yearlyLineItems`; fixed sections live in code. Simple keys (`userId`, `year`, `sectionKey`) and clear indexes.
- **Opus**: Rich and layered. Separate `yearlyForecasts` root plus `yearlySubsections` and `yearlyItems`, with many optional fields tailored to section types.
- **Gemini**: Middle ground. Root `yearly_budgets` with subsections and items, some optional metadata; less extensive than Opus but more than GPT.
- **Droid**: Conceptually similar to GPT but with a `YearlySection` entity and more emphasis on frequency/originalAmount fields.

### Convex API design

- **GPT**: Simple CRUD + reorder + move, scoped by user/year/sectionKey; strongly mirrors existing Monthly API patterns.
- **Opus**: Similar CRUD and reorder operations but wrapped around a `getOrCreateForecast` lifecycle and richer field set.
- **Gemini**: Comparable CRUD and reorder surface to GPT/Opus, centered on fetching a budget by year.
- **Droid**: API set mirrors GPT conceptually but highlights upsert semantics and normalization behavior.

### UI architecture and DnD

- All four plans agree on:
  - Fixed top-level sections.
  - Draggable subsections within sections.
  - Draggable items within subsections.
  - Use of `@dnd-kit` with nested sortable levels and optimistic updates.
- **GPT** is the most explicit about reusing the existing Monthly DnD configuration.
- **Opus** and **Gemini** add more UI components (bottom sheets, income summary components) but at the cost of extra complexity.

### Complexity vs value

- **GPT** offers the lowest complexity and highest alignment with current code, which is ideal for a v1.
- **Opus** maximizes expressiveness and long-term capability but requires more upfront work.
- **Gemini** offers a moderate step up in richness but still introduces a root `yearly_budgets` entity.
- **Droid** keeps complexity focused on normalization and calculations, which are valuable but can be layered on top of a simpler schema.

---

## Recommended base plan

The best single backbone to implement is the **GPT plan** because:

- It aligns most directly with the existing Monthly Forecast implementation (same Convex patterns, same DnD shape, same auth/token usage).
- The schema is minimal yet sufficient for fixed sections, subsections, and items, which keeps migrations and queries simple.
- Indexing strategy is clearly thought through and avoids ad-hoc filters.
- The Convex API surface maps almost one-to-one to the planned UI interactions.
- It’s the most practical for a first version that can be shipped quickly and iterated on.

---

## Suggested combined / improved plan

Building on the GPT plan as the base, the best overall direction is to **augment** it with targeted ideas from Opus, Gemini, and Droid:

- **Data model enhancements (from Opus/Gemini/Droid)**
  - Keep GPT’s `yearlySubsections` and `yearlyLineItems` structure and code-defined `YEARLY_SECTION_DEFS`.
  - Extend `yearlyLineItems` with a small set of optional fields:
    - Generic: `note`, `paymentSource`, `dueDate`.
    - Non-monthly handling: `frequency` and `originalAmountCents` for non-monthly items.
    - Optional long-term fields: `balanceCents`, `interestRate`, `goalAmountCents`, `currentAmountCents`, `startMonth`, `endMonth` for debt and savings.
  - This keeps v1 simple but leaves room to support richer sections without major schema changes.

- **Convex API surface (from GPT with Opus flavor)**
  - Implement GPT’s `listForYear`, subsection CRUD/reorder, and line-item CRUD/reorder/move as described.
  - Consider adding a light “get or create” behavior *inside* `listForYear` (Opus-style) if you decide you want default subsections or seed data, but avoid introducing a separate `yearlyForecasts` table unless needed.

- **Calculations (from Opus and Droid)**
  - Introduce a небольшая helper module (e.g., `src/lib/yearly-calculations.ts`) to compute:
    - Section and subsection totals (based on `amountCents`, normalized monthly values).
    - Monthly equivalents for non-monthly items using `frequency` and `originalAmountCents`.
    - Income Summary “After X” ladder and % of income metrics.
  - Keep these helpers pure and client-side initially so they can evolve without schema changes.

- **UI/UX (from GPT plus Opus/Gemini/Droid)**
  - Implement GPT’s `/yearly` route, card-based layout, and nested DnD.
  - Use a year selector (GPT) and reuse existing Navbar and layout.
  - Gradually introduce:
    - An Income Summary component (Opus/Droid) powered by `yearly-calculations.ts`.
    - Optional bottom-sheet or dialog editors (Opus/Gemini) reusing your existing Sheet/Dialog primitives.
    - Secondary text in item rows for due dates, frequencies, and payment sources.

This combined approach yields a **small, coherent v1** that can be extended in-place as you add more of the spreadsheet’s semantics.

---

## Phased implementation suggestion

1. **Phase 1 – Core data + APIs + basic `/yearly` UI**
   - Implement GPT-style `yearlySubsections` and `yearlyLineItems` tables with the added optional fields.
   - Add `convex/yearly.ts` with `listForYear` and minimal create/update/delete/reorder/move mutations.
   - Create `/yearly` page and section/subsection/item components with nested DnD and optimistic updates.

2. **Phase 2 – Calculations and Income Summary**
   - Add `yearly-calculations.ts` for section totals, non-monthly normalization, and “After X” ladder.
   - Introduce an Income Summary UI and section totals/percent-of-income indicators.

3. **Phase 3 – Richer fields and UX polish**
   - Gradually surface optional fields (due dates, payment sources, debt balances, savings goals) where they add clear value.
   - Add bottom-sheet/dialog editors, collapsible sections, and mobile refinements.

---

## Direct answer to the original question

- **Best single plan:** the GPT plan is the strongest backbone because it’s simple, well-indexed, and tightly aligned with the existing Monthly Forecast code and UX.
- **Best overall approach:** a hybrid that uses the GPT plan as the structural base, while borrowing:
  - Rich but optional item fields and frequency/original-amount ideas from Opus, Gemini, and Droid.
  - Opus/Droid’s emphasis on explicit calculations and Income Summary.
  - Selected UX enhancements (bottom sheets, more detailed item displays) from Opus and Gemini once the core flow is solid.

This should give you a clear path to ship an initial Yearly Forecast quickly, with a roadmap for layering in more of the spreadsheet’s power over time.
