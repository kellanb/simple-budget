# Yearly Forecast Implementation Plan (Final Consolidated)

## Summary

Build a new `/yearly` route that displays a yearly budget with **6 fixed main sections**, **optional user-created draggable subsections**, and **draggable line items**. Line items can live **at the section level (no subsection)** or **inside a subsection**. Data persists in Convex per user per year. Uses the same DnD patterns and UI styling as the Monthly Forecast page.

This plan synthesizes the best approaches from all four agent plans (GPT, Opus, Gemini, Droid) based on the analysis documents. The GPT plan serves as the backbone for its simplicity and alignment with existing codebase patterns, enriched with optional fields from Opus/Droid for frequency, debt, and savings tracking.

### Reference Design

**Google Sheet (source of truth for layout/structure):** [Budget 2026](https://docs.google.com/spreadsheets/d/1QkOFXBKpSGf4WKYUV4YBQmoKGs9Pu9ka87hobRV6zO0/edit?usp=sharing)

The UI should match this Google Sheet's structure exactly:
- Top-to-bottom section order
- Column structure per section type
- Totals and "After X" breakdown positioning

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Schema structure | Two tables (no root forecast table) | Matches existing `months`/`transactions` pattern; simpler queries |
| Fixed sections | Code constants | Reduces DB complexity; sections don't change |
| Subsections | Optional (non-income sections) | Supports both “flat section” and grouped subsections |
| Cross-subsection drag | Supported in v1 (within same section only) | User requested; still keeps sections independent |
| Cross-section moves | Not supported | Prevents accidental category drift; simplifies DnD + validation |
| Cross-level drag | Supported (within same section) | Items can move between section-level and subsections within a section |
| Year selector | Default to current year | User requested |
| Income subsections | None (income is a flat list) | Income summary does not need subgrouping |
| Default subsections (non-income sections) | None (empty start) | User requested |
| Placeholder rows | Allowed (label-only items; amounts can be blank/0) | Supports “note/placeholder” lines and empty subsections |
| Empty sections | Always displayed | Sections may be placeholders or for note-taking; all 6 sections always visible |
| Naming convention | camelCase | Matches existing codebase |
| Mobile UX | Spreadsheet-like pan/zoom | Handles dense data on small screens without breaking table structure |
| Column structure | Section-specific columns | Match Google Sheet exactly; each section has different data needs |
| Income Summary | Editable with draggable items | User requested; not just a read-only summary |
| Income amount source of truth | Monthly amount (`amountCents`) | Drives all totals, “After X”, and % calculations |
| Each Paycheck display | Always derived as `amountCents / 2` (not stored) | Informational only; shows per-paycheck amount assuming 2 paychecks/month |
| Savings goal months | Derived from `startMonth` + `endMonth` (inclusive; month+year, can span multiple years) | Matches your “include start and end month” requirement and supports multi-year goals |
| Savings Monthly + Bi-Monthly | Monthly is derived from `(goalAmountCents - currentAmountCents) / monthsForGoal`; Bi-Monthly = Monthly ÷ 2 (per paycheck) | "Bi-Monthly" means amount per paycheck assuming 2 paychecks/month |
| Savings rounding | Round to nearest cent (`Math.round`) | Matches typical Google Sheets `ROUND` usage and avoids systematically over-saving |
| % of income denominator | Total monthly income from Income Summary (`incomeMonthly`) | All % rows use the same denominator for consistency |
| Section totals/footers | Match Google Sheet exactly | Totals are multi-metric (e.g. debt balance + payment) and must mirror sheet layout |

---

## Mobile Spreadsheet Behavior

On mobile, the entire yearly forecast page behaves like viewing a spreadsheet (similar to Google Sheets/Excel):

### User Interactions
- Pan horizontally and vertically with one finger
- Pinch to zoom in/out
- Double-tap to zoom to fit or 100%
- Content does NOT wrap on mobile - maintains table structure

### Technical Implementation

**Important:** the current app sets `userScalable: false` and `maximumScale: 1` in `src/app/layout.tsx`, which disables native pinch-zoom. To get Google-Sheets-like zoom on `/yearly`, we will use **Option A** (custom in-container zoom).

**Option A (Chosen): Custom in-container zoom (keeps navbar/controls stable)**
- Implement pinch-to-zoom + double-tap on the `SpreadsheetContainer` only (everything below the navbar).
- Use a nested wrapper that scales content via CSS transform, plus a “sizer” div so scrollbars reflect the scaled content size.
- DnD must be scale-aware: dnd-kit translate transforms need compensation when a parent is scaled (details in DnD section).

**Option B (Not chosen): Enable native browser zoom for `/yearly`**
- Add `src/app/yearly/layout.tsx` to override `export const viewport` and allow `userScalable: true` and `maximumScale > 1`.
- Pros: simplest, uses built-in pinch + double-tap behavior.
- Cons: zooms the entire page (navbar included) and varies by browser; less “app-like” control.

1. **`SpreadsheetContainer` component** - Wraps the entire yearly content
   - Uses CSS `overflow: auto` with `-webkit-overflow-scrolling: touch`
   - Content has `min-width` to prevent column collapse
   - For Option A: implement pinch zoom with a gesture lib (recommended: `@use-gesture/react`) and transform scaling
   - For Option A: implement double-tap (see below)

**Double-tap behavior (for Option A)**
- **Option 1: Fit entire sheet width**: double-tap toggles between 100% and a scale that fits the full sheet width into the viewport.
  - Pros: simplest + predictable.
  - Cons: doesn’t help much when you want to zoom into a *specific section* (you’ll still pinch).
- **Option 2: Fit the tapped section** (**recommended**): double-tap toggles between 100% and a scale that fits the *current section/table* (the one you double-tapped) into the viewport width.
  - Pros: matches your goal of “zoom to fit certain sections better”; feels closest to Google Sheets “zoom to what I’m looking at.”
  - Cons: needs hit-testing (`data-zoom-target="section"`) and measuring that section’s width to compute the target scale.

**Recommendation for v1:** implement **Fit the tapped section** with a fallback: if no section is found under the tap, fall back to “fit entire sheet width.”

**Implementation sketch (Option A)**
- **State**: `zoomScale` (e.g. clamp to `[0.5, 3]`), stored in React state (reset to 100% on each visit).
- **DOM structure**:
  - Scroll container (`overflow: auto`) that holds a **sizer** div (width/height reflect scaled content).
  - Inside the sizer, a **content** div with `transform: scale(zoomScale)` and `transform-origin: 0 0`.
- **Pinch behavior**: keep the pinch center stable by adjusting `scrollLeft/scrollTop` when scale changes:
  - Convert the pinch center point into “content coordinates” at the start of the gesture, then on each update set scroll so that point remains under the fingers.
- **Double-tap**:
  - Find the nearest ancestor with `data-zoom-target="section"` (or fall back to the whole sheet).
  - Compute `targetScale = viewportWidth / targetWidth` (clamped), then set scale and scroll so the target is brought into view.

2. **No text wrapping on table cells** - Use `white-space: nowrap` on data cells
   - Smart wrapping only for long notes/descriptions (truncate with tooltip or expand)

3. **Fixed minimum column widths** per section type to maintain structure

```
┌─────────────────────────────────────────────────────────────┐
│ [Navbar - fixed at top]                                     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │   Pannable/Zoomable Content Area                        │ │
│ │   (contains all sections in fixed-width layout)         │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Schema Changes (`convex/schema.ts`)

Add two new tables:

```typescript
yearlySubsections: defineTable({
  userId: v.id("users"),
  year: v.number(),
  sectionKey: v.union(
    v.literal("monthlyBills"),
    v.literal("nonMonthlyBills"),
    v.literal("debt"),
    v.literal("savings"),
    v.literal("investments"),
  ),
  title: v.string(),
  order: v.number(),
})
  .index("by_user_and_year_and_sectionKey", ["userId", "year", "sectionKey"])
  .index("by_user_and_year", ["userId", "year"]),

yearlyLineItems: defineTable({
  userId: v.id("users"),
  year: v.number(),
  sectionKey: v.union(
    v.literal("income"),
    v.literal("monthlyBills"),
    v.literal("nonMonthlyBills"),
    v.literal("debt"),
    v.literal("savings"),
    v.literal("investments"),
  ),
  // Optional: items can exist at the section level (no subsection) or inside a subsection.
  // Constraint: income items must not have a subsectionId.
  subsectionId: v.optional(v.id("yearlySubsections")),
  label: v.string(),
  amountCents: v.number(), // Canonical monthly amount for totals (0 allowed for placeholder rows)
  order: v.number(),
  // Display fields
  note: v.optional(v.string()),
  paymentSource: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  // Non-monthly normalization
  frequency: v.optional(v.union(
    v.literal("monthly"),
    v.literal("quarterly"),
    v.literal("biannual"),
    v.literal("annual")
  )),
  originalAmountCents: v.optional(v.number()), // Pre-normalized amount
  // Debt fields
  balanceCents: v.optional(v.number()),
  interestRate: v.optional(v.number()),
  // Savings fields
  goalAmountCents: v.optional(v.number()),
  currentAmountCents: v.optional(v.number()),
  // Month+year strings (sheet-like): e.g. "Jan 2026", "Dec 2027"
  startMonth: v.optional(v.string()),
  endMonth: v.optional(v.string()),
  // Investments fields (bi-monthly is derived as amountCents / 2, but we store paymentDate separately)
  paymentDay: v.optional(v.string()), // e.g. "16th" - day of month for investment contributions
})
  .index("by_subsection_and_order", ["subsectionId", "order"])
  .index("by_user_year_sectionKey_order", ["userId", "year", "sectionKey", "order"])
  .index("by_user_and_year", ["userId", "year"]),
```

### Section-Specific Column Definitions

Each section type has its own column structure (matching the [Google Sheet](https://docs.google.com/spreadsheets/d/1QkOFXBKpSGf4WKYUV4YBQmoKGs9Pu9ka87hobRV6zO0)):

| Section | Columns |
|---------|---------|
| **Income** | Label, Monthly Total (canonical), Each Paycheck (derived = monthly ÷ 2, informational only) |
| **Monthly Bills** | Payment To, Due Date, Amount, Payment Source |
| **Non-Monthly Bills** | Payment To, Due Date, Amount, Monthly Amount, Payment Source |
| **Debt** | Owed To, Balance, Interest Rate, Monthly Payment, Payment Date, Payment Source |
| **Savings** | Allocate To, Current Amount, Goal Amount, Start Month, End Month, Months for Goal, Monthly, Bi-Monthly |
| **Investments** | Allocate To, Monthly, Bi-Monthly, Date, % of Total Income |

**Section-specific notes:**
- **Non-Monthly Bills:** Frequency is represented via **subsections** (Quarterly, Bi-Annual, Annual), not a column. The "Due Date" column can hold multiple dates (e.g., "1/20, 4/20, 7/20, 10/20" for quarterly). "Monthly Amount" shows the monthly equivalent.
- **Savings:** "Bi-Monthly" = Monthly ÷ 2 (amount per paycheck, assuming 2 paychecks/month). When goal is already met (current ≥ goal) or start/end dates are missing, show "—" for Monthly and Bi-Monthly.
- **Investments:** Each item has its own "% of Total Income" column. "Bi-Monthly" = Monthly ÷ 2 (amount per paycheck).

Define column configurations in `src/components/yearly/column-definitions.ts`:

### Fixed Sections (Code Constants)

Define in `convex/yearly.ts` or a shared constants file:

```typescript
export const YEARLY_SECTION_DEFS = [
  { key: "income", title: "Income Summary" },
  { key: "monthlyBills", title: "Monthly Bills" },
  { key: "nonMonthlyBills", title: "Non-Monthly Bills" },
  { key: "debt", title: "Debt" },
  { key: "savings", title: "Savings" },
  { key: "investments", title: "Investments" },
] as const;

export type YearlySectionKey = typeof YEARLY_SECTION_DEFS[number]["key"];

// Convenience for rendering the 5 “subsection-based” sections (income is rendered separately)
export const YEARLY_SUBSECTION_SECTION_DEFS = [
  { key: "monthlyBills", title: "Monthly Bills" },
  { key: "nonMonthlyBills", title: "Non-Monthly Bills" },
  { key: "debt", title: "Debt" },
  { key: "savings", title: "Savings" },
  { key: "investments", title: "Investments" },
] as const;

export type YearlySubsectionSectionKey =
  typeof YEARLY_SUBSECTION_SECTION_DEFS[number]["key"];
```

---

## Backend API (`convex/yearly.ts`)

Create new file with the following functions. All use `requireSession(ctx, token)` from `convex/utils.ts`.

### Query

| Function | Args | Returns | Purpose |
|----------|------|---------|---------|
| `listForYear` | `{ token, year }` | `{ subsections, sectionItems }` | Main data fetch for the page |

#### `listForYear` Return Shape

```typescript
type YearlyDataForYear = {
  subsections: Array<{
    _id: Id<"yearlySubsections">;
    sectionKey: YearlySubsectionSectionKey;
    title: string;
    order: number;
    items: Array<YearlyLineItem>; // Items belonging to this subsection
  }>;
  // Items with no subsection (subsectionId = undefined). Includes income items and any “flat section-level” items.
  sectionItems: Array<YearlyLineItem>;
};
```

The frontend groups by `sectionKey` and renders all 6 sections (from `YEARLY_SECTION_DEFS`), even if empty.

### Subsection Mutations

| Function | Args | Purpose |
|----------|------|---------|
| `createSubsection` | `{ token, year, sectionKey, title }` | Create new subsection with max order + 1 |
| `updateSubsection` | `{ token, subsectionId, patch: { title? } }` | Rename subsection |
| `removeSubsection` | `{ token, subsectionId }` | Delete subsection and cascade delete its items |
| `reorderSubsections` | `{ token, year, sectionKey, orderedIds }` | Reorder using existing pattern from `transactions.ts` |

**Notes:**
- Subsections are only for non-income sections (`monthlyBills`, `nonMonthlyBills`, `debt`, `savings`, `investments`).
- `sectionKey: "income"` is not valid for these subsection mutations.

### Line Item Mutations

| Function | Args | Purpose |
|----------|------|---------|
| `createLineItem` | `{ token, year, sectionKey, subsectionId?, label, amountCents, ...optionalFields }` | Create item (`subsectionId` optional; for `income`, must omit) |
| `updateLineItem` | `{ token, lineItemId, patch }` | Update item fields |
| `removeLineItem` | `{ token, lineItemId }` | Delete item |
| `reorderLineItems` | `{ token, year, sectionKey, subsectionId?, orderedIds }` | Reorder items within a container (subsection OR section-level within the same section) |
| `moveLineItem` | `{ token, lineItemId, toSubsectionId?, sourceOrderedIds, destOrderedIds }` | Move between containers (section-level ↔ subsection, or subsection ↔ subsection) within the same section |

### Implementation Notes

- Use `.withIndex()` for all queries (no `.filter()`)
- Reorder mutations loop over `orderedIds` and patch `order: i` (same as `transactions.reorder`)
- `removeSubsection` should collect and delete all items first, then delete the subsection
- All mutations verify ownership via `requireSession` + `userId` check
- `moveLineItem` must validate:
  - The destination subsection (if provided) belongs to the same user/year, and
  - The destination subsection’s `sectionKey` matches the item’s `sectionKey` (prevents cross-section moves)
- `createLineItem` must enforce: if `sectionKey === "income"`, then `subsectionId` must be absent

---

## Calculations Module (`src/lib/yearly-calculations.ts`)

New file with pure helper functions for client-side calculations:

```typescript
export type Frequency = "monthly" | "quarterly" | "biannual" | "annual";

export type YearlyLineItem = {
  _id: string;
  sectionKey: string;
  subsectionId?: string; // absent for income items
  label: string;
  amountCents: number;
  frequency?: Frequency;
  originalAmountCents?: number;
  // ... other fields
};

export type SectionTotals = {
  // All "amount" totals below are MONTHLY-equivalent cents unless explicitly named otherwise.
  incomeMonthly: number;
  // Display-only: derived from monthly (informational only, not used in calculations)
  incomeEachPaycheckDisplay: number; // = incomeMonthly / 2

  monthlyBillsMonthly: number;

  nonMonthlyBillsMonthlyEq: number;
  nonMonthlyBillsAnnualTotal: number;

  debtMonthlyPayment: number;
  debtBalanceTotal: number;

  savingsMonthly: number;
  savingsBiMonthly: number; // = savingsMonthly / 2 (per paycheck)
  savingsGoalTotal: number;
  savingsCurrentTotal: number;

  investmentsMonthly: number;
  investmentsBiMonthly: number; // = investmentsMonthly / 2 (per paycheck)
};

export type IncomeBreakdown = {
  totalIncomeMonthly: number;
  afterMonthlyBills: number;
  afterNonMonthlyBills: number;
  afterDebt: number;
  afterSavings: number;
  afterInvestments: number; // Final disposable
};

// Convert non-monthly to monthly equivalent
export function paymentsPerYear(frequency: Frequency): number {
  switch (frequency) {
    case "monthly": return 12;
    case "quarterly": return 4;
    case "biannual": return 2;
    case "annual": return 1;
  }
}

// Non-monthly: user enters `originalAmountCents` as the amount billed per period (quarter/half-year/year).
export function annualTotalFromOriginal(originalAmountCents: number, frequency: Frequency): number {
  return originalAmountCents * paymentsPerYear(frequency);
}

export function monthlyEquivalentFromOriginal(originalAmountCents: number, frequency: Frequency): number {
  // Example: quarterly -> amount * 4 / 12, biannual -> amount * 2 / 12, annual -> amount * 1 / 12
  return Math.round(annualTotalFromOriginal(originalAmountCents, frequency) / 12);
}

// Savings: month+year strings like "Jan 2026" and "Dec 2027" (inclusive; can span multiple years).
export function monthsForGoalInclusive(
  startMonth: string,
  endMonth: string,
): number | null {
  // Parse start/end month+year strings and compute inclusive month count across years.
  // Example: start="Jan 2026", end="Dec 2027" => 24
  // Return null if invalid or if end < start.
  // Return null if invalid.
}

// Sum items by section (already normalized to monthly)
export function computeSectionTotals(items: YearlyLineItem[]): SectionTotals {
  // IMPORTANT: must match Google Sheet footer totals exactly (multi-metric per section).
  // Treat placeholder rows (e.g. amountCents = 0) as 0 in totals.
}

// Calculate "After X" ladder
export function computeIncomeBreakdown(totals: SectionTotals): IncomeBreakdown {
  const totalIncomeMonthly = totals.incomeMonthly;
  const afterMonthlyBills = totalIncomeMonthly - totals.monthlyBillsMonthly;
  const afterNonMonthlyBills = afterMonthlyBills - totals.nonMonthlyBillsMonthlyEq;
  const afterDebt = afterNonMonthlyBills - totals.debtMonthlyPayment;
  const afterSavings = afterDebt - totals.savingsMonthly;
  const afterInvestments = afterSavings - totals.investmentsMonthly;
  
  return { totalIncomeMonthly, afterMonthlyBills, afterNonMonthlyBills, afterDebt, afterSavings, afterInvestments };
}

// Percentage helper
export function percentOfIncome(amountCents: number, totalIncome: number): number {
  if (totalIncome === 0) return 0;
  return Math.round((amountCents / totalIncome) * 100);
}
```

---

## Frontend Structure

### Route (`src/app/yearly/page.tsx`)

Client component structure:

```typescript
"use client";

export default function YearlyPage() {
  // Auth
  const { user } = useAuth();
  
  // Year state (default to current year)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Data fetching
  const yearlyData = useQuery(api.yearly.listForYear, 
    user ? { token: user.token, year: selectedYear } : "skip"
  );
  
  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  
  // Calculations
  const totals = useMemo(() => computeSectionTotals(allItems), [allItems]);
  const breakdown = useMemo(() => computeIncomeBreakdown(totals), [totals]);
  
  return (
    <main>
      <Navbar items={navItems} onSignOut={signOut} />
      <YearSelector year={selectedYear} onChange={setSelectedYear} />
      <YearlyIncomeSummary breakdown={breakdown} />
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {YEARLY_SUBSECTION_SECTION_DEFS.map(section => (
          <YearlySectionCard key={section.key} section={section} ... />
        ))}
      </DndContext>
      <YearlyItemFormSheet ... />
    </main>
  );
}
```

### Components (`src/components/yearly/`)

| Component | Purpose |
|-----------|---------|
| `SpreadsheetContainer` | Mobile pan/zoom wrapper for entire content (touch-action pan/pinch-zoom) |
| `YearlySectionTable` | Generic table wrapper with section-specific column headers |
| `YearlySectionCard` | Fixed section container with header, totals/% of income, **section-level items**, **subsections**, and “Add item / Add subsection” actions |
| `YearlySubsection` | Draggable subsection with editable title, subtotal, list of items, drag handle, "Add item" button |
| `YearlyLineItemRow` | Draggable item row that renders correct cells based on section type |
| `YearlyItemFormSheet` | Bottom sheet for add/edit items using existing `Sheet` component |
| `YearlySubsectionFormSheet` | Simple dialog/sheet for add/rename subsection |
| `YearlyIncomeSummary` | Editable section with draggable income items + calculated "After X" rows |
| `YearSelector` | Dropdown for year selection |
| `YearlyColumnHeader` | Renders correct column headers based on section type |

### Component Hierarchy

```
YearlyPage
├── Navbar (existing, fixed at top)
├── SpreadsheetContainer (pan/zoom wrapper)
│   ├── YearSelector
│   ├── DndContext
│   │   ├── YearlyIncomeSummary (editable with draggable income items)
│   │   │   ├── SortableContext (income items)
│   │   │   │   └── YearlyLineItemRow (draggable)
│   │   │   ├── Total Income row (calculated)
│   │   │   └── "After X" breakdown rows (calculated)
│   │   └── YearlySectionTable (x5: Monthly Bills, Non-Monthly, Debt, Savings, Investments)
│   │       ├── YearlyColumnHeader (section-specific columns)
│   │       ├── SortableContext (section-level items; subsectionId = undefined)
│   │       │   └── YearlyLineItemRow (draggable, section-specific cells)
│   │       ├── "Add item" button (section-level)
│   │       ├── SortableContext (subsections)
│   │       │   └── YearlySubsection (draggable)
│   │       │       ├── Subsection header + subtotal
│   │       │       ├── SortableContext (items)
│   │       │       │   └── YearlyLineItemRow (draggable, section-specific cells)
│   │       │       └── "Add item" button (in subsection)
│   │       ├── "Add subsection" button
│   │       └── Section total + % of income row
│   └── (empty space for scroll)
├── YearlyItemFormSheet
└── YearlySubsectionFormSheet
```

---

## DnD Implementation

### Sensor Configuration

Same as Monthly page:

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
);
```

### Draggable Data Tagging

```typescript
// For subsections
const { attributes, listeners, setNodeRef } = useSortable({
  id: subsection._id,
  data: { type: "subsection", sectionKey: subsection.sectionKey },
});

// For items (section-level or in subsections; `subsectionId` is undefined for section-level items)
const { attributes, listeners, setNodeRef } = useSortable({
  id: item._id,
  data: { type: "lineItem", subsectionId: item.subsectionId, sectionKey: item.sectionKey },
});

// For income items (no subsections)
const { attributes, listeners, setNodeRef } = useSortable({
  id: incomeItem._id,
  data: { type: "incomeLineItem", sectionKey: "income" },
});
```

### Drag End Handler

```typescript
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  
  const activeData = active.data.current;
  const overData = over.data.current;
  
  if (activeData.type === "subsection") {
    // Reorder subsections within section
    const reordered = arrayMove(subsections, oldIndex, newIndex);
    setOptimisticSubsections(reordered);
    await reorderSubsections({ token, year, sectionKey, orderedIds: reordered.map(s => s._id) });
  } else if (activeData.type === "incomeLineItem") {
    // Reorder income items (flat list)
    const reordered = arrayMove(incomeItems, oldIndex, newIndex);
    setOptimisticIncomeItems(reordered);
    await reorderLineItems({ token, year, sectionKey: "income", orderedIds: reordered.map(i => i._id) });
  } else if (activeData.type === "lineItem") {
    // No cross-section moves
    if (activeData.sectionKey !== overData.sectionKey) return;

    const sameContainer = activeData.subsectionId === overData.subsectionId;

    if (sameContainer) {
      // Reorder within the same container (subsection OR section-level when subsectionId is undefined)
      const reordered = arrayMove(items, oldIndex, newIndex);
      setOptimisticItems(reordered);
      await reorderLineItems({
        token,
        year,
        sectionKey: activeData.sectionKey,
        subsectionId: activeData.subsectionId, // undefined = section-level container
        orderedIds: reordered.map((i) => i._id),
      });
    } else {
      // Move between containers (section-level ↔ subsection, or subsection ↔ subsection) within the same section
      await moveLineItem({
        token,
        lineItemId: active.id,
        toSubsectionId: overData.subsectionId, // undefined = move to section-level
        sourceOrderedIds: [...],
        destOrderedIds: [...],
      });
    }
  }
};
```

### Zoom + DnD (Option A)
If the yearly page uses in-container transform scaling, dnd-kit draggable transforms must be compensated by the current zoom scale so the dragged item tracks the pointer accurately. Plan this as a shared “zoomScale” value that `YearlySubsection`/`YearlyLineItemRow` can use to divide the dnd-kit `transform.x/y` before rendering `CSS.Transform.toString(...)`.

---

## UI/UX Design

### Page Layout (Top to Bottom)

Match the [Google Sheet](https://docs.google.com/spreadsheets/d/1QkOFXBKpSGf4WKYUV4YBQmoKGs9Pu9ka87hobRV6zO0) structure exactly:

```
┌─────────────────────────────────────────────────────────────┐
│ Year Selector: [2026 ▼]                                     │
├─────────────────────────────────────────────────────────────┤
│ INCOME SUMMARY                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                        Monthly Total   Each Paycheck    │ │
│ │ [≡] Kellan Income         $10,000.00      $5,000.00     │ │
│ │ [≡] Haly Income            $4,400.00      $2,200.00     │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ Total Income              $14,400.00      $7,200.00     │ │
│ │                                                         │ │
│ │ After Monthly Bills        $X,XXX.XX     YY.YY%         │ │
│ │ After Non-Monthly Bills    $X,XXX.XX     YY.YY%         │ │
│ │ After Debt                 $X,XXX.XX     YY.YY%         │ │
│ │ After Savings              $X,XXX.XX     YY.YY%         │ │
│ │ After Investments          $X,XXX.XX     YY.YY%         │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ MONTHLY BILLS                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Payment To    │ Due Date │ Amount    │ Payment Source   │ │
│ │ ───────────────────────────────────────────────────────│ │
│ │ [Non-Discretionary]                            $X,XXX  │ │
│ │  [≡] Rent           1st      $3,400.00   BILT          │ │
│ │  [≡] Groceries      1st      $700.00     -             │ │
│ │  [+ Add item]                                          │ │
│ │ [Discretionary]                                $X,XXX  │ │
│ │  [≡] Subscriptions  1st      $100.00     -             │ │
│ │  [+ Add item]                                          │ │
│ │ [+ Add subsection]                                     │ │
│ │ ───────────────────────────────────────────────────────│ │
│ │ Total:              $6,335.40    % of Income: 44.00%   │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ NON-MONTHLY BILLS (different columns per schema above)      │
├─────────────────────────────────────────────────────────────┤
│ DEBT                                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Owed To │ Balance │ Interest │ Monthly │ Date │ Source │ │
│ │ ───────────────────────────────────────────────────────│ │
│ │ [≡] Nelnet  $29,653  4.50%    $463.85   3rd   Autopay  │ │
│ │ [+ Add item]                                           │ │
│ │ ───────────────────────────────────────────────────────│ │
│ │ Total: $29,653.43   $463.85   % of Income: 3.22%       │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ SAVINGS                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Allocate To │ Current │ Goal │ Start │ End │ Mo │ BiMo │ │
│ │ ───────────────────────────────────────────────────────│ │
│ │ [≡] Emergency    $5,000   $5,000   -     -    -    -   │ │
│ │ [≡] Overhead    $40,000  $86,922  Jan   Dec  $3,910   │ │
│ │ [+ Add item]                                           │ │
│ │ ───────────────────────────────────────────────────────│ │
│ │ Total: $45,000   $191,922   $3,910.24   27.15%         │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ INVESTMENTS                                                 │
└─────────────────────────────────────────────────────────────┘
```

### Drag-and-Drop Behavior

**What's Draggable:**
1. **Income line items** - Reorder within Income Summary (drag handle [≡])
2. **Subsections** - Reorder within their parent section
3. **Line items** - Reorder within section-level or within a subsection, and move between containers (section-level ↔ subsection, subsection ↔ subsection) within the same section

**Not Draggable / Not Allowed:**
- Subsections cannot move across sections
- Line items cannot move across sections

**Auto-Update on Drag:**
- Subsection subtotals recalculate immediately
- Section totals recalculate immediately
- Income Summary "After X" values recalculate
- All percentages update in real-time

---

## Sheet-Faithful Totals (Must Match Google Sheet)

The plan above establishes data + UI structure, but totals must be implemented **from an explicit sheet spec** (not "best guess"). Footer rows per section (verified against Google Sheet):

- **Income Summary footer**: Total Monthly (sum of each person's monthly income); Each Paycheck column shows `Monthly / 2` (informational).
- **Monthly Bills footer**: 
  - Per-subsection totals (Non-Discretionary Total, Discretionary Total, Business Tools Total, etc.)
  - Overall Total (sum of all items)
  - % of Total Income
  - *(Optional v2: "Total Excluding Rent" as a special derived metric)*
- **Non-Monthly Bills footer**: 
  - Per-frequency subsection totals (Quarterly Total, Bi-Annual Total, Annual Total)
  - Overall Total (Amount column) + Monthly Amount total
  - *(% of income not shown in sheet, but can be added)*
- **Debt footer**: Total Balance + Total Monthly Payment + % of Total Income
- **Savings footer**: Total Current + Total Goal + Total Monthly + Total Bi-Monthly + % of Total Income
- **Investments footer**: Total Monthly + Total Bi-Monthly + overall % of Total Income

### Proposed default formulas (confirm against the sheet)

These defaults are implementable and consistent; if the Google Sheet differs, update this section and implement those exact formulas instead.

| Section | Metric | Default definition |
|---------|--------|-------------------|
| **Income** | Total Monthly | \(\sum\) of income item `amountCents` |
| **Income** | Each Paycheck | `amountCents / 2` (informational only, not used in calculations) |
| **Income** | After X | `incomeMonthly - (sum of preceding section monthly-equivalent totals)` |
| **Income** | After X % | `round((afterX / incomeMonthly) * 100)` |
| **Monthly Bills** | Total | \(\sum\) of `amountCents` across section-level + subsection items |
| **Monthly Bills** | % of income | `round((monthlyBillsTotal / incomeMonthly) * 100)` |
| **Non‑Monthly Bills** | Annual Total (per item) | `originalAmountCents * paymentsPerYear(frequency)` |
| **Non‑Monthly Bills** | Monthly Eq (per item) | `round(annualTotal / 12)` |
| **Non‑Monthly Bills** | Subsection Totals | sum per-item Annual Total (and optionally sum Monthly Eq) within the subsection |
| **Non‑Monthly Bills** | Section Totals | sum subsection Annual Totals; sum subsection Monthly Eq totals |
| **Debt** | Total Balance | \(\sum\) of `balanceCents` |
| **Debt** | Total Monthly Payment | \(\sum\) of `amountCents` |
| **Debt** | % of income | uses Total Monthly Payment / incomeMonthly |
| **Savings** | Months for Goal (per item) | inclusive month count from `startMonth` to `endMonth` (month+year; e.g. "Jan 2026" → "Dec 2026" = 12). Return `null` if dates missing or invalid. |
| **Savings** | Monthly (per item) | `(goalAmountCents - currentAmountCents) / monthsForGoal` rounded to nearest cent. Return `null`/show "—" when: goal ≤ current, or start/end dates missing. |
| **Savings** | Bi-Monthly (per item) | `Monthly / 2` (amount per paycheck, assuming 2 paychecks/month). Show "—" when Monthly is null. |
| **Savings** | Totals | sum Current; sum Goal; sum Monthly (excluding nulls); sum Bi-Monthly (excluding nulls) |
| **Investments** | Monthly (per item) | `amountCents` (stored value) |
| **Investments** | Bi-Monthly (per item) | `amountCents / 2` (amount per paycheck) |
| **Investments** | % of Total Income (per item) | `round((amountCents / incomeMonthly) * 100)` |
| **Investments** | Totals | sum Monthly; sum Bi-Monthly; overall % of income |

Where `paymentsPerYear` defaults to:
- `monthly`: 12
- `quarterly`: 4
- `biannual`: 2
- `annual`: 1

---

## Remaining Questions / Final Decisions to Lock

1. **Savings month+year input format** ✅ RESOLVED
   - **Decision:** Accept both `MMM YYYY` (e.g. `Jan 2026`) and `MMMM YYYY` (e.g. `January 2026`) on input. Display as `MMM YYYY`.
   - **Decision:** Allow save even if end < start or dates are missing. Show "—" for derived columns (Months for Goal, Monthly, Bi-Monthly) until corrected. This matches how the sheet handles incomplete data gracefully.

### Mobile Considerations

- **Spreadsheet-like pan/zoom** for entire page (see Mobile Spreadsheet Behavior section)
- Touch-friendly drag handles (min 44px touch target)
- Bottom sheets for forms (existing `Sheet` component)
- No hover-only affordances
- No text wrapping on data cells (maintains table structure)
- Avoid iOS zoom triggers (16px+ input font size)

---

## Implementation Phases

### Phase 1: Core Data + API ✅ COMPLETED (2025-12-28)
1. ✅ Add schema tables with indexes to `convex/schema.ts` (including new optional fields)
2. ✅ Create `convex/yearly.ts` with `YEARLY_SECTION_DEFS` + `YEARLY_SUBSECTION_SECTION_DEFS`
3. ✅ Implement `listForYear` query
4. ✅ Implement all subsection mutations (`createSubsection`, `updateSubsection`, `removeSubsection`, `reorderSubsections`)
5. ✅ Implement all line item mutations (`createLineItem`, `updateLineItem`, `removeLineItem`, `reorderLineItems`, `moveLineItem`)

**Files created/modified:**
- `convex/schema.ts` - Added `yearlySubsections` and `yearlyLineItems` tables with all indexes
- `convex/yearly.ts` - New file with section constants, types, query, and all mutations

### Phase 2: Basic UI with Section-Specific Tables ✅ COMPLETED (2025-12-28)
1. ✅ Create `src/app/yearly/page.tsx` route shell
2. ✅ Create `SpreadsheetContainer` component with mobile pan/zoom (pinch-zoom, double-tap, scroll)
3. ✅ Create `src/components/yearly/column-definitions.ts` with per-section column configs
4. ✅ Build `YearSelector` component
5. ✅ Build `YearlySectionTable` that renders correct headers/cells per section type
6. ✅ Build editable `YearlyIncomeSummary` at top (with income items + "After X" breakdown)
7. ✅ Build `YearlySubsection` component (without DnD initially)
8. ✅ Build `YearlyLineItemRow` component (renders based on section type)
9. ✅ Build `YearlyItemFormSheet` and `YearlySubsectionFormSheet`
10. ✅ Wire up basic CRUD operations

**Files created:**
- `src/app/yearly/page.tsx` - Main yearly forecast page with all CRUD wired up
- `src/lib/yearly-calculations.ts` - Calculation helpers (totals, breakdown, derived values)
- `src/components/yearly/types.ts` - TypeScript type definitions
- `src/components/yearly/column-definitions.ts` - Column configs and section colors per section type
- `src/components/yearly/spreadsheet-container.tsx` - Mobile pan/zoom wrapper with pinch-zoom
- `src/components/yearly/year-selector.tsx` - Year navigation component
- `src/components/yearly/yearly-line-item-row.tsx` - Line item row with section-specific cells
- `src/components/yearly/yearly-subsection.tsx` - Subsection component with header and items
- `src/components/yearly/yearly-section-table.tsx` - Section table with columns, items, subsections, totals
- `src/components/yearly/yearly-income-summary.tsx` - Income section with "After X" breakdown
- `src/components/yearly/yearly-item-form-sheet.tsx` - Form sheet for adding/editing line items
- `src/components/yearly/yearly-subsection-form-sheet.tsx` - Form sheet for adding/editing subsections

### Phase 3: DnD + Calculations ✅ COMPLETED (2025-12-28)
1. ✅ Add DnD context and sortable wrappers
2. ✅ Implement income item reordering in Income Summary
3. ✅ Implement subsection reordering within sections
4. ✅ Implement item reordering within subsection
5. ✅ Implement cross-container item moves (section-level ↔ subsection, subsection ↔ subsection)
6. ✅ Create `src/lib/yearly-calculations.ts` (completed in Phase 2)
7. ✅ Implement auto-recalculation on drag (subtotals, totals, "After X" values)
8. ✅ Add totals/percentages to section footers (completed in Phase 2)

**Changes made:**
- `src/app/yearly/page.tsx` - Added DndContext, sensors, drag handlers for all scenarios (income reorder, subsection reorder, item reorder, cross-container moves)
- `src/components/yearly/yearly-income-summary.tsx` - Added SortableContext and SortableIncomeRow for draggable income items
- `src/components/yearly/yearly-section-table.tsx` - Added SortableContext for subsections and DroppableSectionItems for section-level items
- `src/components/yearly/yearly-subsection.tsx` - Added SortableSubsection, SortableContext for items, droppable container support, and YearlySubsectionOverlay
- `src/components/yearly/yearly-line-item-row.tsx` - Added SortableLineItemRow wrapper with useSortable hook

### Phase 4: Polish ✅ COMPLETED (2025-12-28)
1. ✅ Add loading states and error handling
2. ✅ Mobile touch refinements for drag handles (44px touch targets)
3. ✅ Optional zoom controls (floating buttons for zoom in/out/reset)
4. ✅ Smart truncation with tooltips for long text cells
5. ✅ Non-monthly frequency display (show original + monthly equivalent) - already implemented in Phase 2 column definitions
6. ✅ Surface optional fields (due date, payment source) in item display - already implemented in Phase 2 column definitions
7. ✅ Run lint/typecheck (Phase 4 files clean; pre-existing issues in other files not addressed)

**Changes made:**
- `src/app/yearly/page.tsx` - Added loading states (Loader2 spinner), error handling with dismissible error banner, TouchSensor for mobile DnD
- `src/components/yearly/spreadsheet-container.tsx` - Added floating zoom controls (zoom in/out/reset buttons) with visual indicators
- `src/components/yearly/yearly-line-item-row.tsx` - Updated drag handle to 44px touch target, added smart truncation with tooltips
- `src/components/yearly/yearly-subsection.tsx` - Updated drag handle to 44px touch target
- `src/components/yearly/yearly-income-summary.tsx` - Updated drag handle to 44px touch target, updated column widths
- `src/components/yearly/yearly-section-table.tsx` - Updated column widths for 44px drag handles
- `src/components/ui/tooltip.tsx` - New reusable tooltip component with TruncatedText helper for smart truncation

---

## Files to Create/Modify

### New Files (Phase 1 - Backend)
- ✅ `convex/yearly.ts` - Backend API (section constants, query, mutations)

### New Files (Phase 2 - Frontend)
- ✅ `src/app/yearly/page.tsx` - Yearly Forecast page
- ✅ `src/lib/yearly-calculations.ts` - Calculation helpers (totals, breakdown, derived values)
- ✅ `src/components/yearly/types.ts` - TypeScript type definitions
- ✅ `src/components/yearly/column-definitions.ts` - Column configs per section type
- ✅ `src/components/yearly/spreadsheet-container.tsx` - Mobile pan/zoom wrapper
- ✅ `src/components/yearly/year-selector.tsx` - Year navigation
- ✅ `src/components/yearly/yearly-line-item-row.tsx` - Renders cells based on section type
- ✅ `src/components/yearly/yearly-subsection.tsx` - Subsection with header and items
- ✅ `src/components/yearly/yearly-section-table.tsx` - Table with columns, items, subsections, totals
- ✅ `src/components/yearly/yearly-income-summary.tsx` - Income section with "After X" breakdown
- ✅ `src/components/yearly/yearly-item-form-sheet.tsx` - Form for adding/editing items
- ✅ `src/components/yearly/yearly-subsection-form-sheet.tsx` - Form for adding/editing subsections

### Modified Files (Phase 3 - DnD) ✅ COMPLETED
- `src/app/yearly/page.tsx` - Added DndContext, sensors, drag start/end handlers
- `src/components/yearly/yearly-income-summary.tsx` - Added SortableContext, SortableIncomeRow
- `src/components/yearly/yearly-section-table.tsx` - Added SortableContext, DroppableSectionItems
- `src/components/yearly/yearly-subsection.tsx` - Added SortableSubsection, YearlySubsectionOverlay, droppable support
- `src/components/yearly/yearly-line-item-row.tsx` - Added SortableLineItemRow

### New Files (Phase 4 - Polish) ✅ COMPLETED
- `src/components/ui/tooltip.tsx` - Tooltip component with TruncatedText for smart truncation

### Modified Files (Phase 4 - Polish) ✅ COMPLETED
- `src/app/yearly/page.tsx` - Added loading states, error handling, TouchSensor
- `src/components/yearly/spreadsheet-container.tsx` - Added floating zoom controls
- `src/components/yearly/yearly-line-item-row.tsx` - 44px touch targets, smart truncation
- `src/components/yearly/yearly-subsection.tsx` - 44px touch targets
- `src/components/yearly/yearly-income-summary.tsx` - 44px touch targets
- `src/components/yearly/yearly-section-table.tsx` - Updated column widths

### Modified Files
- ✅ `convex/schema.ts` - Added `yearlySubsections` and `yearlyLineItems` tables with all indexes

---

## Testing Checklist

### Core Functionality
- [ ] Sign in and navigate to `/yearly`
- [ ] Year selector defaults to current year, can switch years
- [ ] Create section-level line items (no subsection)
- [ ] Create subsections in each section
- [ ] Create line items in subsections
- [ ] Edit subsection titles
- [ ] Edit line item fields (section-specific fields display correctly)
- [ ] Delete subsections (confirms cascade delete of items)
- [ ] Delete line items

### Drag-and-Drop (Phase 3 Implementation Complete - Ready for Testing)
- [ ] Drag reorder income items in Income Summary
- [ ] Drag reorder subsections within a section
- [ ] Drag reorder items within a subsection
- [ ] Drag reorder section-level items within a section
- [ ] Drag item from section-level INTO a subsection (same section)
- [ ] Drag item from subsection OUT to section-level (same section)
- [ ] Drag item from subsection A to subsection B (same section)
- [ ] Totals auto-update immediately on drag

### Calculations (Phase 2-3 Implementation Complete - Ready for Testing)
- [ ] Income summary "After X" values update correctly with changes
- [ ] Section totals display correctly
- [ ] Percentages of income display correctly
- [ ] Non-monthly bills show both original and monthly equivalent

### Data Persistence
- [ ] Refresh page - verify data persists
- [ ] Switch years - verify data is per-year

### Section-Specific Columns
- [ ] Income section shows: Label, Monthly Total, Each Paycheck (derived = monthly ÷ 2, informational only)
- [ ] Monthly Bills shows: Payment To, Due Date, Amount, Payment Source
- [ ] Non-Monthly Bills shows: Payment To, Due Date, Amount, Monthly Amount, Payment Source (frequency via subsections)
- [ ] Debt shows: Owed To, Balance, Interest Rate, Monthly Payment, Payment Date, Payment Source
- [ ] Savings shows: Allocate To, Current Amount, Goal Amount, Start Month, End Month, Months for Goal, Monthly, Bi-Monthly
- [ ] Investments shows: Allocate To, Monthly, Bi-Monthly, Date, % of Total Income

### Edge Cases
- [ ] Savings: Item with goal already met (current ≥ goal) shows "—" for Monthly and Bi-Monthly
- [ ] Savings: Item with missing start/end dates shows "—" for Months for Goal, Monthly, Bi-Monthly
- [ ] Investments: Per-item % of Total Income calculates correctly
- [ ] Non-Monthly Bills: Subsection totals (Quarterly/Bi-Annual/Annual) display correctly

### Mobile Spreadsheet Behavior
- [ ] Mobile: pan horizontally and vertically with one finger
- [ ] Mobile: pinch to zoom in/out works smoothly
- [ ] Mobile: double-tap to zoom works
- [ ] Mobile: table structure maintained (no cell wrapping)
- [ ] Mobile: touch drag works smoothly with 44px touch targets
- [ ] Mobile: forms work correctly in bottom sheets

---

## Post-Implementation: Minor Issues & Recommendations

*Identified during verification on 2025-12-28. **All issues resolved on 2025-12-28.***

### Issue 1: Duplicated Month Parsing Logic (DRY Violation) ✅ RESOLVED

**Files affected:**
- `src/lib/yearly-calculations.ts` — now exports `parseMonthYear`
- `src/components/yearly/yearly-section-table.tsx` — now imports from calculations
- `src/components/yearly/yearly-subsection.tsx` — now imports from calculations

**Resolution:** Exported `parseMonthYear` from `yearly-calculations.ts` and updated component files to import it instead of duplicating the logic.

---

### Issue 2: Unused `showControls` State Variable ✅ RESOLVED

**File:** `src/components/yearly/spreadsheet-container.tsx`

**Resolution:** Removed the unused `showControls` and `setShowControls` state. Zoom controls are now always visible (simpler UX; auto-hide can be added later if needed).

---

### Issue 3: Double-Tap Behavior Differs from Plan ✅ RESOLVED

**File:** `src/components/yearly/spreadsheet-container.tsx`

**Resolution:** Implemented "fit the tapped section" behavior:
- Double-tap on a section with `data-zoom-target="section"` → zoom to fit that section's width in viewport
- Double-tap again → reset to 100%
- Fallback: if no section found, fit entire sheet width (or 1.5x if already near that scale)

---

### Issue 4: Invalid CSS Class for Overflow Scrolling ✅ RESOLVED

**File:** `src/components/yearly/spreadsheet-container.tsx`

**Resolution:** Changed from invalid CSS class to inline style: `style={{ WebkitOverflowScrolling: 'touch' }}`

---

### Issue 5: Non-Monthly Bills `amountCents` Not Auto-Calculated in Form ✅ RESOLVED

**File:** `src/components/yearly/yearly-item-form-sheet.tsx`

**Resolution:** Auto-calculate `amountCents` on submit for non-monthly bills:
```typescript
if (sectionKey === "nonMonthlyBills" && currentForm.originalAmountCents !== undefined) {
  const frequency = currentForm.frequency ?? "quarterly";
  const monthlyAmount = monthlyEquivalentFromOriginal(currentForm.originalAmountCents, frequency);
  formToSubmit = { ...currentForm, amountCents: monthlyAmount };
}
```

---

### Issue 6: ESLint Disable Comments for DnD Props ✅ RESOLVED

**Files:**
- `src/components/yearly/yearly-subsection.tsx`
- `src/components/yearly/yearly-line-item-row.tsx`

**Resolution:** Replaced `any` types with proper dnd-kit types:
```typescript
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

dragHandleProps?: DraggableAttributes;
dragListeners?: SyntheticListenerMap;
```

---

### Summary Table

| # | Issue | Status |
|---|-------|--------|
| 1 | Duplicated month parsing | ✅ Resolved |
| 2 | Unused `showControls` state | ✅ Resolved |
| 3 | Double-tap zoom behavior | ✅ Resolved |
| 4 | Invalid CSS class | ✅ Resolved |
| 5 | Non-monthly `amountCents` | ✅ Resolved |
| 6 | ESLint disable comments | ✅ Resolved |

