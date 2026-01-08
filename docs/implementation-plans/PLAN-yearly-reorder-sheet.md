---
name: Yearly reorder sheet
overview: Replace flaky in-table drag/drop with a dedicated Reorder side panel (desktop) / full-screen sheet (mobile) that reliably reorders subsections and line items (including moving items between subsection and section-level within the same section).
todos:
  - id: sheet-right-variant
    content: Extend `SheetContent` to support a responsive right-side panel variant while keeping centered modal behavior for existing forms.
    status: pending
  - id: yearly-reorder-sheet
    content: Implement a dedicated reorder sheet UI (per section) that supports subsection reorder + line item reorder/move using existing Convex mutations.
    status: pending
    dependencies:
      - sheet-right-variant
  - id: wire-reorder-entrypoints
    content: Add “Reorder” buttons to yearly sections and wire open/close + selected section state from the yearly page.
    status: pending
    dependencies:
      - yearly-reorder-sheet
  - id: disable-old-dnd
    content: Disable/remove the existing in-table DnD so the reorder sheet is the single, reliable ordering mechanism.
    status: pending
    dependencies:
      - wire-reorder-entrypoints
---

# Dedicated reorder UI for Yearly Forecast

## Goals
- Provide a **reliable** way to reorder yearly line items **within section-level lists and within/between subsections** (same section only).
- Allow **reordering subsections** themselves.
- Do this in a dedicated UI that avoids the current table/zoom/scroll complexity.

## Key observations from the codebase
- Ordering is already modeled and persisted:
  - `yearlySubsections.order` + `api.yearly.reorderSubsections` (`/Users/k_ben/dev-projects/simple-budget/convex/schema.ts`, `/Users/k_ben/dev-projects/simple-budget/convex/yearly.ts`).
  - `yearlyLineItems.order` + `api.yearly.reorderLineItems` and `api.yearly.moveLineItem`.
- Current DnD is embedded in the zoomable spreadsheet/table and uses nested `SortableContext`s (likely the source of flakiness).
- Your current `Sheet` is a **centered dialog** via `.dialog-content-centered` (`/Users/k_ben/dev-projects/simple-budget/src/components/ui/sheet.tsx`, `/Users/k_ben/dev-projects/simple-budget/src/app/globals.css`). We’ll extend it to support a **right-side panel** layout.

## Proposed UX
- Add a **“Reorder”** button to each yearly section header.
- Clicking opens a **responsive Reorder Sheet**:
  - **Desktop/tablet**: right-side panel.
  - **Mobile**: full-screen sheet.
- Inside the reorder sheet (for one section at a time):
  - A sortable list of **Subsections**.
  - A “No subsection” group for **section-level items**.
  - Each group contains a sortable list of items.
  - Users can drag items **between** “No subsection” and any subsection (same section).

## Implementation outline

### 1) Add a right-side `SheetContent` variant
- Update [`/Users/k_ben/dev-projects/simple-budget/src/components/ui/sheet.tsx`](/Users/k_ben/dev-projects/simple-budget/src/components/ui/sheet.tsx)
  - Add a prop like `position?: "center" | "right"` (default `center` for existing forms).
  - Only apply `.dialog-content-centered` when `position === "center"`.
  - For `right`, use fixed positioning and responsive sizing:
    - Mobile: `inset-0` full screen.
    - `md+`: `right-0 top-0 h-[100dvh] w-[420-520px]` with its own internal scroll.
- Update [`/Users/k_ben/dev-projects/simple-budget/src/app/globals.css`](/Users/k_ben/dev-projects/simple-budget/src/app/globals.css)
  - Keep `.dialog-content-centered` as-is for the default dialog.
  - No new global CSS needed if we use Tailwind classes for the right variant.

### 2) Build the dedicated reorder sheet UI (clean, non-table layout)
- Add a new component, e.g. [`/Users/k_ben/dev-projects/simple-budget/src/components/yearly/yearly-reorder-sheet.tsx`](/Users/k_ben/dev-projects/simple-budget/src/components/yearly/yearly-reorder-sheet.tsx)
  - Use its own `DndContext` + `SortableContext`s over simple `<div>` lists (avoid `<table>/<tbody>/<tr>`).
  - Use prefixed DnD ids to avoid collisions:
    - `subsection:${subId}`, `item:${itemId}`, `container:section`, `container:subsection:${subId}`.
  - On drag end:
    - **Subsection reorder**: update local state and call `api.yearly.reorderSubsections`.
    - **Item reorder within same container**: call `api.yearly.reorderLineItems` with correct `subsectionId` (or undefined for section-level).
    - **Item move between containers**: call `api.yearly.moveLineItem` with `toSubsectionId`, `sourceOrderedIds`, `destOrderedIds`.
  - UX details:
    - Sticky header with section name + “Done”.
    - Expand/collapse subsections if needed for long lists.
    - Big drag handles (mobile-friendly).

### 3) Wire it into the yearly page
- Update [`/Users/k_ben/dev-projects/simple-budget/src/app/yearly/page.tsx`](/Users/k_ben/dev-projects/simple-budget/src/app/yearly/page.tsx)
  - Add state: `reorderOpen`, `reorderSectionKey`.
  - Pass the selected section’s `sectionItems` + `subsections` from `groupedData` into the reorder sheet.
  - Pass the existing Convex mutations (`reorderSubsections`, `reorderLineItems`, `moveLineItem`).
- Update [`/Users/k_ben/dev-projects/simple-budget/src/components/yearly/yearly-section-table.tsx`](/Users/k_ben/dev-projects/simple-budget/src/components/yearly/yearly-section-table.tsx)
  - Add the “Reorder” button in the section header that triggers the open state.

### 4) De-risk UX by disabling/removing the existing in-table DnD
- Goal: avoid two reorder experiences, one of which is known flaky.
- Update the section tables/rows to **stop using the embedded DnD**:
  - Replace `SortableLineItemRow` usage with `YearlyLineItemRow` (non-sortable) and hide/neutralize the grip handle.
  - Replace `SortableSubsection` usage with a non-sortable subsection rendering in the main table.
  - Remove the big DnD handler logic in [`/Users/k_ben/dev-projects/simple-budget/src/app/yearly/page.tsx`](/Users/k_ben/dev-projects/simple-budget/src/app/yearly/page.tsx) once the reorder sheet is the primary mechanism.

### 5) Manual verification
- Verify on desktop + mobile viewport:
  - Reorder subsections.
  - Reorder items within a subsection.
  - Move item from subsection → section-level and back.
  - Ensure data persists after refresh (Convex `order` fields update).

## Notes / future-proofing (optional)
- Add “Move up/down” buttons in the reorder sheet as an accessibility + no-drag fallback (especially for mobile).

