/**
 * Shared constants for yearly forecast sections.
 * This file is safe to import in both frontend and Convex backend.
 */

export const YEARLY_SECTION_DEFS = [
  { key: "income", title: "Income Summary" },
  { key: "monthlyBills", title: "Monthly Bills" },
  { key: "nonMonthlyBills", title: "Non-Monthly Bills" },
  { key: "debt", title: "Debt" },
  { key: "savings", title: "Savings" },
  { key: "investments", title: "Investments" },
] as const;

export type YearlySectionKey = (typeof YEARLY_SECTION_DEFS)[number]["key"];

// Sections that support subsections (income is rendered separately as a flat list)
export const YEARLY_SUBSECTION_SECTION_DEFS = [
  { key: "monthlyBills", title: "Monthly Bills" },
  { key: "nonMonthlyBills", title: "Non-Monthly Bills" },
  { key: "debt", title: "Debt" },
  { key: "savings", title: "Savings" },
  { key: "investments", title: "Investments" },
] as const;

export type YearlySubsectionSectionKey =
  (typeof YEARLY_SUBSECTION_SECTION_DEFS)[number]["key"];

