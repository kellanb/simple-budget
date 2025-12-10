# Project Plan: SIMPLE BUDGET (Budget Flow)
Google sheet to reference: https://docs.google.com/spreadsheets/d/1oYBRGeiIkfiByzXgJt4ZB6CzpECGycW5OBiiGVOdnhA/edit?gid=28656034#gid=28656034

## 1. Project Overview
A mobile-optimized web application to manage monthly personal finances. Unlike standard budget apps, this focuses on **cash flow timing** and **liquidity**. It allows the user to drag and drop transactions to see how the order of payments affects the running bank balance throughout the month.

**Key Goals:**
- **Mobile First:** Optimized for vertical scrolling and touch interactions.
- **Real-Time Forecasting:** "If I pay this bill before that one, will I go negative?"
- **Dynamic Savings:** Calculate savings transfers as a percentage of specific income items.
- **Templates:** Reuse recurring items for future months.

---

## 2. Tech Stack

- **Framework:** Next.js 16.0.8 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4.1 (CSS-first configuration)
- **Components:** Shadcn UI (Card, Checkbox, Badge, ScrollArea, Dialog/Sheet)
- **Backend & Auth:** Convex (Real-time DB + Built-in Auth)
- **Drag & Drop:** `@dnd-kit/core` & `@dnd-kit/sortable`

---

## 3. Core Logic & Math

There are two distinct calculation flows that run simultaneously:

### A. The "Current Bank Balance" (Sticky Header)
Represents actual money in the account *right now*.
> **Formula:** `Starting Balance` + `Sum(Paid Income)` - `Sum(Paid Bills)` - `Sum(Paid Savings)`

### B. The "Projected Waterfall" (List Items)
Represents the forecasted balance after every line item, regardless of "Paid" status. This updates instantly when items are reordered.
> **Formula (Iterative):**
> 1. Start with `Current Bank Balance`.
> 2. Loop through list (ordered by custom drag index).
> 3. Add/Subtract item amount.
> 4. Display result on the item card.

### C. Dynamic Savings Logic
Savings items are visually blue and mathematically treated as withdrawals.
- **Inputs:** Percentage (e.g., 10%) and Linked Income Item ID.
- **Calculation:** `Amount = (Linked_Income_Amount * Percentage) / 100`

---

## 4. Database Schema (Convex)

### `users`
- Standard Convex Auth fields (managed internally).
- `email`: String

### `months`
- `_id`: ID
- `userId`: ID (Ref to users)
- `name`: String (e.g., "December 2024")
- `year`: Number
- `monthIndex`: Number (0-11)
- `startingBalance`: Number (The hard cash amount on Day 1)

### `transactions`
- `_id`: ID
- `monthId`: ID (Ref to months)
- `userId`: ID
- `label`: String (e.g., "Nelnet")
- `type`: String (`"income"` | `"bill"` | `"saving"`)
- `amount`: Number (Hardcoded for Bills/Income; Calculated for Savings)
- `date`: String (Day of month, e.g., "15" or ISO date)
- `isPaid`: Boolean
- `order`: Number (Critical for drag-and-drop sort order)
- **Recurring Logic:**
    - `isRecurring`: Boolean (Flag to copy to next month)
- **Savings Logic:**
    - `savingsPercentage`: Number (Optional, e.g., 10. Only for "saving" type)
    - `linkedIncomeId`: ID (Optional. Reference to an income transaction in the same month)

---

## 5. UI/UX Design (Mobile View)

### A. The Sticky Header ("Dashboard")
- **Top Row:** Month Selector (`< December >`).
- **Main Display:** **Current Bank Balance** (Large text).
    - *Color:* Green if positive, Red if negative.
- **Sub Display:** "Projected End Balance" (Small text).

### B. The Transaction List ("The Flow")
Vertical list of cards.
- **Left:** Drag Handle (6-dot icon).
- **Middle:**
    - Label (Top).
    - Date (Bottom).
- **Right:**
    - Amount (Top - Green/Red/Blue based on type).
    - **Projected Running Balance** (Bottom - Small Gray text).
- **Far Right:** Checkbox (Mark as Paid).

### C. Savings Item Interactions
- Clicking a "Savings" card expands details.
- **Settings:**
    - Toggle: "Fixed Amount" vs "Percentage".
    - Input: % Value (e.g., 10%).
    - Select: "Source Income" (Dropdown of green items in current month).

### D. Month Transition
- "Start New Month" button.
- Prompts for `New Starting Balance`.
- Queries previous month for `isRecurring === true` items.
- Copies them to the new month (maintaining order, resetting `isPaid` to false).

---

## 6. Implementation Plan

### Phase 1: Setup & Auth
- Initialize Next.js, Tailwind v4, Convex.
- specific `convex/schema.ts` setup.
- Implement basic Login screen (Email/Password).

### Phase 2: Basic CRUD & State
- Build `TransactionList` component.
- Create functionality to Add, Edit, Delete items.
- Implement the client-side "Waterfall" calculation loop using local React state.

### Phase 3: Drag & Drop & Advanced Logic
- Integrate `@dnd-kit`.
- Bind drag events to update the `order` field in Convex.
- Implement the "Percentage Savings" calculation logic (reactive updates).

### Phase 4: Month Management
- Build the "New Month" wizard.
- Implement backend function to clone recurring items.
- Refine UI styles (Shadcn customization).

---

## 7. Quick Start Commands

```bash
# 1. Initialize Project
npx create-next-app@latest budget-flow
# Options: Yes to TS, ESLint, Tailwind, src, App Router

# 2. Setup Convex
cd budget-flow
npm install convex
npx convex dev

# 3. Install UI Libs
npx shadcn@latest init
npm install lucide-react clsx tailwind-merge

# 4. Install Drag & Drop
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# 5. Tailwind v4 Upgrade (if needed)
npm install tailwindcss@next @tailwindcss/postcss@next postcss