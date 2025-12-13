# Agent Plans Analysis: Yearly Forecast Feature

## Overview

This document analyzes four implementation plans (`PLAN-yearly-forecast_droid.md`, `PLAN-yearly-forecast_gpt.md`, `PLAN-yearly-forecast_gemini.md`, `PLAN-yearly-forecast_opus.md`) for the new Yearly Forecast feature. The goal is to determine the optimal path forward by evaluating each plan's strengths and weaknesses and proposing a synthesized approach.

## Individual Plan Analysis

### 1. Droid (`PLAN-yearly-forecast_droid.md`)
*   **Focus**: Mobile-first UX, calculation logic ("After X" waterfall), and mirroring the Google Sheet.
*   **Data Model**: Reuses GPT's `yearlySubsections` / `yearlyLineItems` structure but adds `frequency`, `originalAmount` fields.
*   **Strengths**:
    *   **Calculation Logic**: Explicitly details the "Income Summary" waterfall (Income - Bills - Debt, etc.), which is a critical value proposition of the original spreadsheet.
    *   **Mobile UX**: Strong focus on mobile interactions (touch targets, collapsible sections).
*   **Weaknesses**: Relies on GPT's base structure, so it inherits any limitations there if not fully fleshed out.

### 2. GPT (`PLAN-yearly-forecast_gpt.md`)
*   **Focus**: Pragmatic integration with the existing Monthly Forecast architecture.
*   **Data Model**: Flat structure keyed by `userId` and `year`. Does **not** use a root "YearlyForecast" table.
    *   `yearlySubsections`
    *   `yearlyLineItems`
*   **Strengths**:
    *   **Simplicity**: Best alignment with the current `months` schema pattern.
    *   **Low Friction**: Easiest to implement immediately with minimal schema overhead.
*   **Weaknesses**: Lacks specific fields for Debt/Savings (balance, interest) in the initial spec, potentially requiring schema migrations later.

### 3. Gemini (`PLAN-yearly-forecast_gemini.md`)
*   **Focus**: Comprehensive schema definition and explicit entity types.
*   **Data Model**: Introduces a root `yearlyForecasts` table.
    *   `yearlyForecasts` -> `yearlySubsections` -> `yearlyItems`
*   **Strengths**:
    *   **Field Specificity**: Detailed schema for `yearlyItems` including `balanceCents`, `interestRate`, `goalAmountCents`.
    *   **Structure**: Explicit root object is cleaner for potential future features (e.g., sharing forecasts, multiple versions).
*   **Weaknesses**: The root `yearlyForecasts` table is slightly divergent from the existing flat `months` pattern, though arguably "correct" for normalization.

### 4. Opus (`PLAN-yearly-forecast_opus.md`)
*   **Focus**: API surface and "Budget" entity modeling.
*   **Data Model**: Uses `yearly_budgets` as a root entity.
*   **Strengths**:
    *   **API Design**: Clearly defined mutations and queries.
    *   **Explicit Naming**: Uses `budget` nomenclature which may be more intuitive than `forecast`.
*   **Weaknesses**: Similar to Gemini, introduces a root entity that might be overkill if the app is strictly single-user per year.

## Synthesis & Recommendation

The best approach is a **hybrid plan** that uses the **GPT/Droid** flat data model (for simplicity and consistency) but enriches the line item schema with the **Gemini/Opus** optional fields.

### Recommended Architecture

1.  **Data Model (Schema)**
    *   **No Root Table**: Key everything by `userId` and `year` (like GPT).
    *   **`yearlySubsections`**: Standard container for drag-and-drop groups.
    *   **`yearlyLineItems`**: Single table for all item types, but with **optional sparse fields** (from Gemini/Opus):
        *   `frequency` (monthly, quarterly, annual)
        *   `originalAmountCents`
        *   `dueDate`
        *   `balanceCents`
        *   `interestRate`
        *   `goalAmountCents`

2.  **Logic & Calculations**
    *   Implement the **Droid** calculation module (`yearly-calculations.ts`) to handle the "Income Summary" waterfall. This is essential for the feature's utility.

3.  **User Interface**
    *   Follow the **Droid/GPT** mobile-first card layout.
    *   Use the `dnd-kit` implementation pattern already established in the Monthly view.

## Proposed Implementation Plan

1.  **Schema Definition**:
    *   Define `yearlySubsections` and enriched `yearlyLineItems` in `convex/schema.ts`.
2.  **Backend API**:
    *   Create `convex/yearly.ts` with standard CRUD + Reorder mutations.
3.  **Frontend Shell**:
    *   Create `/yearly` route and Year Selector.
4.  **Core Components**:
    *   Implement `YearlySectionCard` and `YearlySubsection` with optimistic DnD.
5.  **Smart Components**:
    *   Implement `YearlyIncomeSummary` using the "After X" calculation logic.
