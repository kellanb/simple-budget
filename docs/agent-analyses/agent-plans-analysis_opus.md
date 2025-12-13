# Yearly Forecast: Agent Plans Analysis (Opus)

## Overview

This document analyzes and compares four AI-generated implementation plans for the Yearly Forecast feature:
- `PLAN-yearly-forecast_gpt.md`
- `PLAN-yearly-forecast_opus.md`
- `PLAN-yearly-forecast_gemini.md`
- `PLAN-yearly-forecast_droid.md`

The goal is to determine which plan (or combination) provides the best foundation for implementing a mobile-first Yearly Forecast page with fixed sections, draggable subsections, and draggable line items.

---

## Per-Plan Summaries

### GPT Plan

**Intent & Scope**
- Build a `/yearly` route mirroring Google Sheet structure with fixed top-level sections and user-created subsections/items
- No Google Sheet import/sync; all data persisted in Convex per user per year

**Data Model**
- Two tables: `yearlySubsections` and `yearlyLineItems`
- No parent "forecast" table; uses `userId + year + sectionKey` as composite key
- Fixed sections defined as code constants (`YEARLY_SECTION_DEFS`)
- Minimal optional fields (`note` only)

**Backend/API Shape**
- `convex/yearly.ts` with standard CRUD pattern
- Query: `listForYear`
- Mutations: `createSubsection`, `updateSubsection`, `removeSubsection`, `reorderSubsections`, `createLineItem`, `updateLineItem`, `removeLineItem`, `reorderLineItems`, `moveLineItem`
- Uses `requireSession(ctx, token)` pattern from existing codebase

**Frontend/UX**
- Route: `src/app/yearly/page.tsx`
- Year selector with default to current year
- Components: `YearlySectionCard`, `YearlySubsection`, `YearlyLineItemRow`
- Single `DndContext` with two-level sortable setup

**Notable Strengths**
- Most closely aligned with existing Monthly Forecast implementation
- Clean, minimal schema without unnecessary tables
- Clear index strategy matching existing patterns
- Explicit reuse of existing components and patterns

**Notable Weaknesses**
- Lacks rich optional fields for non-monthly frequency, payment sources, debt/savings tracking
- No explicit calculations module specified
- Income Summary "After X" breakdown not detailed

---

### Opus Plan

**Intent & Scope**
- Comprehensive yearly forecast replicating Google Spreadsheet budget structure
- Includes detailed section-specific field requirements

**Data Model**
- Three tables: `yearlyForecasts`, `yearlySubsections`, `yearlyItems`
- Parent forecast table links user to year
- Rich item fields: `frequency`, `dueDate`, `paymentSource`, `balanceCents`, `interestRate`, `goalAmountCents`, `currentAmountCents`, `startMonth`, `endMonth`
- `subsectionId` is optional (items can exist directly under section)

**Backend/API Shape**
- `getOrCreateForecast` pattern for ensuring forecast exists
- Separate `listSubsections` and `listItems` queries
- `moveItemToSubsection` for cross-subsection moves

**Frontend/UX**
- Collapsible section cards
- Section-specific item display based on fields
- Detailed "After X" breakdown in Income Summary
- Bottom sheets for forms

**Notable Strengths**
- Most comprehensive field coverage for all section types
- Explicit calculations module (`src/lib/yearly-calculations.ts`)
- Clear implementation checklist
- Detailed section-specific field breakdown

**Notable Weaknesses**
- Most complex schema (3 tables)
- `yearlyForecasts` parent table may be unnecessary overhead
- Optional `subsectionId` adds complexity for items
- Higher implementation effort

---

### Gemini Plan

**Intent & Scope**
- Support yearly budget structure with subsections and items
- Dynamic form fields based on section type

**Data Model**
- Three tables: `yearly_budgets`, `budget_subsections`, `budget_items`
- Uses underscore naming convention (inconsistent with existing codebase)
- Rich optional fields for debt/savings

**Backend/API Shape**
- Standard CRUD: `get`, `createSubsection`, `updateSubsection`, `deleteSubsection`, `reorderSubsections`, `createItem`, `updateItem`, `deleteItem`, `reorderItems`
- No cross-subsection move function specified

**Frontend/UX**
- `YearlyBudgetView` as main container
- `BudgetMainSection`, `BudgetSubsection`, `BudgetItemCard`
- `EditItemSheet` with dynamic fields
- Accordion-style sections

**Notable Strengths**
- Good optional field coverage
- Dynamic form fields based on section
- Mobile optimization considerations

**Notable Weaknesses**
- Shortest/least detailed plan
- Naming conventions don't match existing codebase
- Parent `yearly_budgets` table adds unnecessary complexity
- Missing cross-subsection move capability

---

### Droid Plan

**Intent & Scope**
- Mobile-first page with fixed sections, editable draggable subsections, and line items
- Mirror styling patterns from Monthly Forecast

**Data Model**
- Conceptual three tables: `YearlySection`, `YearlySubsection`, `YearlyItem`
- Frequency support: monthly, quarterly, biAnnual, annual, oneOff
- Rich item fields including `scheduleDescription`, `paymentSource`, `notes`

**Backend/API Shape**
- `getYearlyForecast({ userId, year })`
- Standard CRUD + reorder operations
- Optional `moveItem` for cross-subsection drag

**Frontend/UX**
- Route: `/yearly` or `/yearly-forecast`
- Stacked cards per main section, mobile-first single column
- Section Card with totals/% income
- Inline or sheet-based editor

**Notable Strengths**
- Clear open decisions section requiring confirmation
- Good calculation breakdown (Total Excluding Rent, normalized amounts)
- Explicit delivery steps
- "Total Excluding Rent" consideration

**Notable Weaknesses**
- Less Convex-specific detail
- More high-level, less implementation-ready
- Schema presented conceptually rather than as code

---

## Cross-Plan Comparison

| Dimension | GPT | Opus | Gemini | Droid |
|-----------|-----|------|--------|-------|
| **Schema Tables** | 2 | 3 | 3 | 3 (conceptual) |
| **Parent Forecast Table** | No | Yes | Yes | Yes |
| **Naming Convention** | camelCase | camelCase | snake_case | PascalCase |
| **Item Fields** | Minimal | Comprehensive | Rich | Rich |
| **Frequency Support** | No | Yes | No | Yes |
| **Calculations Module** | Implicit | Explicit | Minimal | Listed |
| **Cross-Subsection Move** | Yes | Yes | No | Optional |
| **Implementation Detail** | High | Very High | Low | Medium |
| **Codebase Alignment** | Highest | Medium | Low | Medium |

### Where Plans Agree
- Fixed top-level sections (6 sections: Income, Monthly Bills, Non-Monthly Bills, Debt, Savings, Investments)
- User-created subsections within sections
- Draggable line items within subsections
- Use of `@dnd-kit` for drag-and-drop
- Mobile-first design approach
- Year selector functionality

### Where Plans Differ
- **Schema complexity**: GPT keeps it minimal; others add parent tables
- **Optional fields**: GPT is sparse; Opus is comprehensive
- **API naming**: `listForYear` vs `getOrCreateForecast` patterns
- **Calculations**: Only Opus explicitly specifies a calculations module

---

## Recommended Base Plan

**GPT Plan** is the best foundation for implementation.

Reasons:
1. **Closest alignment with existing codebase** - Uses identical patterns to `convex/transactions.ts` for auth, indexes, and mutations
2. **Minimal schema** - Two tables without unnecessary parent table; `userId + year` composite works fine
3. **Code-defined sections** - `YEARLY_SECTION_DEFS` as constants reduces DB complexity
4. **Clear index strategy** - Proper Convex indexes matching existing patterns
5. **Explicit pattern reuse** - References existing components (`Sheet`, `Card`) and DnD setup

---

## Suggested Combined/Improved Plan

### Data Model
Use GPT's two-table structure (`yearlySubsections` + `yearlyLineItems`) but adopt rich optional fields from Opus/Gemini:

```
yearlyLineItems:
  - userId, year, sectionKey, subsectionId (required)
  - label, amountCents, order (required)
  - note, paymentSource, dueDate (optional display)
  - frequency, originalAmountCents (optional for non-monthly)
  - balanceCents, interestRate (optional for debt)
  - goalAmountCents, currentAmountCents, startMonth, endMonth (optional for savings)
```

### Convex API Surface
Follow GPT's CRUD + reorder + move pattern:
- `listForYear({ token, year })` - returns nested structure
- Standard mutations for subsections and items
- `moveLineItem` for cross-subsection moves within same section

Defer Opus's `getOrCreateForecast` pattern unless explicitly needed later.

### Calculations
Add explicit helper module (Opus-style):

```
src/lib/yearly-calculations.ts:
  - monthlyEquivalent(amount, frequency) - normalize non-monthly to monthly
  - computeSectionTotals(data) - sum items per section/subsection
  - computeIncomeBreakdown(totals) - "After X" ladder calculation
```

### UI/UX
GPT's `/yearly` route and nested DnD layout, optionally enhanced with:
- Collapsible sections for mobile (Opus)
- Bottom sheets for forms (reuse existing `Sheet` component)
- Section-specific field display in item rows

---

## Phased Implementation Suggestion

**Phase 1: Core Structure**
- Add schema tables with indexes
- Create `convex/yearly.ts` with full API
- Build `/yearly` page shell with year selector
- Implement basic section/subsection/item rendering with DnD

**Phase 2: Calculations & Display**
- Create `yearly-calculations.ts` module
- Add section totals and % of income display
- Implement Income Summary "After X" breakdown

**Phase 3: Enhanced Features**
- Surface optional fields in forms (frequency, payment source, etc.)
- Add collapsible sections for mobile
- Polish touch targets and scroll behavior
- Add non-monthly frequency display with original amount

---

## Direct Answer

### Best Plan As-Is
**GPT Plan** - It is the most directly aligned with the existing Monthly Forecast implementation, keeps the data model lean, and provides clear implementation guidance that matches established patterns.

### Should Plans Be Combined?
**Yes.** A combined approach yields a meaningfully better plan:

1. **Foundation**: GPT's two-table schema and API structure
2. **Rich Fields**: Opus/Gemini's optional item fields for frequency, debt, and savings tracking
3. **Calculations**: Opus's explicit `yearly-calculations.ts` module for totals and "After X" breakdown
4. **UX Enhancements**: Opus's collapsible sections and Droid's attention to mobile ergonomics

This combination preserves GPT's simplicity and codebase alignment while incorporating the most valuable features from other plans without over-engineering the initial implementation.
