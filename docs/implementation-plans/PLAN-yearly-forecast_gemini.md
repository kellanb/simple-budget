# Yearly Forecast Implementation Plan

## 1. Database Schema (`convex/schema.ts`)

Add tables to support the yearly budget structure:

- **`yearly_budgets`**:
  - `userId`: v.id("users")
  - `year`: v.number()
  - `name`: v.string() (e.g., "2026 Budget")

- **`budget_subsections`**:
  - `budgetId`: v.id("yearly_budgets")
  - `mainSection`: v.string() (Enum: "income", "monthly_bills", "non_monthly_bills", "debt", "savings")
  - `title`: v.string() (e.g., "Discretionary")
  - `order`: v.number()

- **`budget_items`**:
  - `subsectionId`: v.id("budget_subsections")
  - `label`: v.string()
  - `amount`: v.number() (Primary amount, e.g. Monthly Payment)
  - `order`: v.number()
  - **Optional Fields (for specific section types):**
    - `paymentSource`: v.optional(v.string())
    - `dueDate`: v.optional(v.string()) (Text to support "1/20, 4/20")
    - `balance`: v.optional(v.number()) (Debt)
    - `interestRate`: v.optional(v.number()) (Debt)
    - `goalAmount`: v.optional(v.number()) (Savings)
    - `currentAmount`: v.optional(v.number()) (Savings)
    - `startMonth`: v.optional(v.string()) (Savings)
    - `endMonth`: v.optional(v.string()) (Savings)

## 2. Backend API (`convex/yearly.ts`)

- `get`: Fetch budget for a year (with full hierarchy of subsections and items).
- `createSubsection`: Add a new subsection to a main section.
- `updateSubsection`: Rename/Update subsection.
- `deleteSubsection`: Remove subsection (and its items).
- `reorderSubsections`: Update order of subsections.
- `createItem`: Add item to a subsection.
- `updateItem`: Update item details.
- `deleteItem`: Remove item.
- `reorderItems`: Update order of items within a subsection.

## 3. Frontend Implementation

### A. Routing & Layout
- Create `src/app/yearly/page.tsx`.
- Update `src/components/ui/navbar.tsx` to link to `/yearly`.

### B. Components (`src/components/yearly/`)
- **`YearlyBudgetView`**: Main container managing state and drag-and-drop context.
- **`BudgetMainSection`**: Renders a fixed section (e.g., "Monthly Bills") with its header and stats.
- **`BudgetSubsection`**: Draggable sortable container for items.
- **`BudgetItemCard`**: Detailed card displaying fields specific to the item type.
- **`EditItemSheet`**: Form for adding/editing items with dynamic fields based on section.
- **`EditSubsectionDialog`**: Dialog to add/rename subsections.

### C. UI/UX Details
- **Mobile Optimization**:
  - Cards for items (stacking details like "Due Date" and "Source").
  - Accordion-style or vertically stacked Main Sections.
  - Sticky header for specific section totals if needed, or just top summary.
- **Drag & Drop**:
  - Use `@dnd-kit/core` and `@dnd-kit/sortable`.
  - Two levels: Subsections (within Main Section), Items (within Subsection).
  - Handle drag constraints (items stay within their section type).

## 4. Logic & Math
- **Calculations**:
  - "After X" percentages (Income - Bills / Income).
  - Section Totals (Sum of items).
  - Monthly vs Annual amounts (for Non-Monthly bills, calculate monthly equivalent for display).
