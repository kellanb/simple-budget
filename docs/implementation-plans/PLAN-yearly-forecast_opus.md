# Yearly Forecast Feature Plan

## Overview

Build a new `/yearly` route that replicates the Google Spreadsheet budget structure as a mobile-optimized web interface. The feature will have 6 fixed main sections with editable/draggable subsections and line items.

---

## Data Model

### New Convex Schema Tables

Add to `convex/schema.ts`:

```typescript
// One forecast per user per year
yearlyForecasts: defineTable({
  userId: v.id("users"),
  year: v.number(),
}).index("by_user_year", ["userId", "year"]),

// Subsections within main sections (e.g., "Non-Discretionary", "Business Tools")
yearlySubsections: defineTable({
  forecastId: v.id("yearlyForecasts"),
  userId: v.id("users"),
  section: v.union(
    v.literal("income"),
    v.literal("monthlyBills"),
    v.literal("nonMonthlyBills"),
    v.literal("debt"),
    v.literal("savings"),
    v.literal("investments")
  ),
  name: v.string(),
  order: v.number(),
}).index("by_forecast_section", ["forecastId", "section"]),

// Individual line items
yearlyItems: defineTable({
  forecastId: v.id("yearlyForecasts"),
  userId: v.id("users"),
  subsectionId: v.optional(v.id("yearlySubsections")), // null = directly under section
  section: v.union(
    v.literal("income"),
    v.literal("monthlyBills"),
    v.literal("nonMonthlyBills"),
    v.literal("debt"),
    v.literal("savings"),
    v.literal("investments")
  ),
  name: v.string(),
  // Flexible fields for different section types
  amountCents: v.optional(v.number()),
  monthlyAmountCents: v.optional(v.number()),
  frequency: v.optional(v.union(
    v.literal("monthly"),
    v.literal("quarterly"),
    v.literal("biannual"),
    v.literal("annual")
  )),
  dueDate: v.optional(v.string()),
  paymentSource: v.optional(v.string()),
  // Debt-specific
  balanceCents: v.optional(v.number()),
  interestRate: v.optional(v.number()),
  // Savings-specific
  currentAmountCents: v.optional(v.number()),
  goalAmountCents: v.optional(v.number()),
  startMonth: v.optional(v.string()),
  endMonth: v.optional(v.string()),
  order: v.number(),
}).index("by_forecast_section", ["forecastId", "section"])
  .index("by_subsection", ["subsectionId"]),
```

---

## Backend (Convex Functions)

Create `convex/yearly.ts` with:

| Function | Type | Purpose |
|----------|------|---------|
| `getOrCreateForecast` | mutation | Get/create yearly forecast for user+year |
| `listSubsections` | query | List all subsections for a forecast |
| `createSubsection` | mutation | Add new subsection to a section |
| `updateSubsection` | mutation | Rename subsection |
| `deleteSubsection` | mutation | Remove subsection (moves items to "uncategorized") |
| `reorderSubsections` | mutation | Reorder subsections within a section |
| `listItems` | query | List all items for a forecast |
| `createItem` | mutation | Add new line item |
| `updateItem` | mutation | Edit line item |
| `deleteItem` | mutation | Remove line item |
| `reorderItems` | mutation | Reorder items within a subsection |
| `moveItemToSubsection` | mutation | Move item between subsections |

---

## Frontend Structure

### New Files

```
src/app/yearly/
  page.tsx              # Main yearly forecast page

src/components/yearly/
  yearly-section.tsx    # Collapsible section container
  subsection.tsx        # Draggable subsection with items
  item-row.tsx          # Draggable line item row
  income-summary.tsx    # Special calculated summary section
  item-form-sheet.tsx   # Bottom sheet for add/edit items
  subsection-form-sheet.tsx  # Bottom sheet for add/edit subsections
```

### Main Sections (Fixed Order)

1. **Income Summary** - Shows income items + calculated "After X" summaries
2. **Monthly Bills** - Default subsections: Non-Discretionary, Discretionary, Business Tools
3. **Non-Monthly Bills** - Default subsections: Quarterly, Bi-Annual, Annual
4. **Debt** - Loans with balance/interest/payment
5. **Savings** - Goals with current/target/timeline
6. **Investments** - Investment allocations

---

## UI/UX Design

### Section Layout

Each main section will be a collapsible card:

```
[Section Header]  ──────────────────  [Total] [Expand/Collapse]
│
├── [Subsection: Non-Discretionary]  ─────────  [Subtotal]
│   ├── [≡] Rent                    1st   $3,400   [Edit]
│   ├── [≡] Groceries               1st   $700     [Edit]
│   └── [+ Add Item]
│
├── [Subsection: Discretionary]  ─────────────  [Subtotal]
│   └── ...
│
└── [+ Add Subsection]
```

### Drag & Drop

- **Items**: Drag within subsection or between subsections (same section)
- **Subsections**: Drag to reorder within their parent section
- Use `@dnd-kit/core` with nested `SortableContext` (same as monthly forecast)

### Mobile Optimizations

- Touch-friendly drag handles (same as monthly forecast)
- Bottom sheets for forms (existing `Sheet` component)
- Collapsible sections to reduce scrolling
- Sticky section headers while scrolling

### Item Fields by Section Type

| Section | Fields |
|---------|--------|
| Income | Name, Amount (monthly), Amount (per paycheck) |
| Monthly Bills | Name, Due Date, Amount, Payment Source |
| Non-Monthly Bills | Name, Due Date(s), Amount, Monthly Equivalent, Frequency, Payment Source |
| Debt | Name, Balance, Interest Rate, Monthly Payment, Payment Date, Payment Source |
| Savings | Name, Current Amount, Goal Amount, Start/End Month, Monthly/Bi-Monthly calc |
| Investments | Name, Amount, Frequency |

---

## Calculations

Implement in `src/lib/yearly-calculations.ts`:

- **Total Income**: Sum of all income items
- **Section Totals**: Sum of all items in section
- **Subsection Totals**: Sum of items in subsection
- **"After X" Summaries**:
  - After Monthly Bills = Total Income - Monthly Bills Total
  - After Non-Monthly Bills = Above - (Non-Monthly Bills Total / 12)
  - After Debt = Above - Debt Monthly Payments
  - After Savings = Above - Savings Monthly Amount
  - After Investments = Above - Investments Monthly Amount
- **Percentage of Income**: (Amount / Total Income) * 100

---

## Implementation Order

1. **Schema + Backend** - Add tables and Convex functions
2. **Basic Page Structure** - Route, layout, year selector
3. **Income Section** - Simplest section to start
4. **Monthly Bills Section** - With subsections
5. **Non-Monthly Bills Section** - Different frequency handling
6. **Debt Section** - Balance/interest fields
7. **Savings Section** - Goal tracking fields
8. **Investments Section** - Similar to savings
9. **Drag & Drop** - Subsections and items
10. **Calculations** - Summary card with "After X" values
11. **Polish** - Mobile refinements, animations

---

## Key Patterns from Monthly Forecast to Reuse

- `DndContext` + `SortableContext` setup from `src/app/page.tsx`
- `TransactionRow` pattern for item rows
- `Sheet` component for forms
- `Card` styling and dark mode support
- `Navbar` integration with yearly as second nav item
- Optimistic updates pattern for drag reordering

---

## Implementation Checklist

- [ ] Add `yearlyForecasts`, `yearlySubsections`, and `yearlyItems` tables to `convex/schema.ts`
- [ ] Create `convex/yearly.ts` with CRUD operations for forecasts, subsections, and items
- [ ] Create `src/app/yearly/page.tsx` with basic layout and year selector
- [ ] Build `yearly-section.tsx` and `subsection.tsx` components with collapsible UI
- [ ] Create `item-row.tsx` with section-specific field display
- [ ] Build `item-form-sheet.tsx` and `subsection-form-sheet.tsx` with dynamic fields
- [ ] Implement drag-and-drop for subsections and items using `@dnd-kit`
- [ ] Create `yearly-calculations.ts` for totals and "After X" summaries
- [ ] Build `income-summary.tsx` component showing calculated breakdowns
- [ ] Mobile refinements, scroll behavior, and animations
