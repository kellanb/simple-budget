## Yearly Forecast Page – Implementation Plan

### Scope
- Build a mobile-first Yearly Forecast page with fixed main sections (Income Summary, Monthly Bills, Non-Monthly Bills, Debt, Savings, Investments).
- Allow editable, draggable subsections within sections (e.g., Non-Discretionary, Discretionary, Business Tools, Quarterly, Bi-Annual, Annual).
- Enable draggable line items similar to the Monthly Forecast page.
- Mirror the sheet’s totals/percentages and styling patterns from the Monthly Forecast UI.

### Data Model (Convex)
- **Tables/Types** (per user/year):
  - `YearlySection`: id, key, title, order (fixed list in code; persisted for data binding).
  - `YearlySubsection`: id, sectionId, title, order (draggable within a section).
  - `YearlyItem`: id, subsectionId, label, amountMonthly, originalAmount?, frequency?, scheduleDescription?, paymentSource?, notes?, order.
- **Frequencies**: monthly | quarterly | biAnnual | annual | oneOff (stored mainly for display/original amount conversion).

### Backend Operations (Convex-style)
- `getYearlyForecast({ userId, year })` – return sections + subsections + items.
- `createSubsection`, `updateSubsectionTitle`, `deleteSubsection` (cascade or migrate items).
- `upsertYearlyItem`, `deleteYearlyItem`.
- `reorderSubsections({ sectionId, orderedSubsectionIds })`.
- `reorderItems({ subsectionId, orderedItemIds })`.
- Optional: `moveItem({ itemId, targetSubsectionId, targetIndex })` for cross-subsection drag.
- Use optimistic updates like Monthly Forecast.

### Routing & Layout
- New route: `/yearly` (or `/yearly-forecast`) using same layout shell as Monthly Forecast.
- Nav updates: add Yearly tab/entry alongside Monthly.
- Page structure: stacked cards per main section, mobile-first single column.

### UI Components
- **Section Card**: header with title + section totals/% income; body with draggable subsections; “Add subsection” at bottom.
- **Subsection**: editable title, subtotal, drag handle; list of items; “Add line item”.
- **Item Row**: label, schedule/payment source microcopy, main amount (monthly or normalized), helper showing original amount if non-monthly; drag handle; tap to edit/delete.
- Editor (inline or sheet): fields label, amount, frequency, scheduleDescription, paymentSource, notes.

### Drag & Drop
- Reuse `@dnd-kit` patterns from Monthly Forecast.
- Subsections: reorder within a main section → `reorderSubsections`.
- Items: reorder within a subsection; optional cross-subsection moves → `reorderItems` or `moveItem`.

### Totals & Calculations (client-side helpers)
- **Income Summary**: Total Income; After Monthly Bills; After Non-Monthly Bills (monthly equivalent); After Debt; After Savings; After Investments; % of Total Income where applicable.
- **Monthly Bills**: Non-Discretionary total, Discretionary total, Business Tools total, Total Excluding Rent (special case by label or flag), Total, % of Income.
- **Non-Monthly Bills**: normalize originalAmount → amountMonthly (Quarterly /3, Bi-Annual /6, Annual /12); show Quarterly/Bi-Annual/Annual totals, overall total and monthly equivalent.
- **Debt/Savings/Investments**: totals and % of Income, mirroring sheet.

### Styling & Mobile Considerations
- Reuse Monthly Forecast design tokens/components (cards, buttons, inputs, badges).
- Touch-friendly drag handles and tap targets; no hover-only affordances.
- Avoid iOS zoom triggers; ensure smooth scroll + drag.

### Open Decisions (need confirmation)
1) Should items be movable between subsections inside a main section (cross-subsection drag) or only reordered within their current subsection for V1?
2) For “Total Excluding Rent”, is detecting label "Rent" acceptable, or should an explicit flag mark exclusion items?
3) Start with implicit current year or add a year selector in V1?

### Delivery Steps (after confirmations)
1) Add Convex schema/types and queries/mutations for Yearly Forecast.
2) Build `/yearly` page shell + nav entry using existing layout.
3) Implement subsection + item UI with DnD wiring to mutations.
4) Add totals helpers + Income Summary bar and per-section subtotals.
5) Mobile polish and QA; then run lint/tests/typecheck.
