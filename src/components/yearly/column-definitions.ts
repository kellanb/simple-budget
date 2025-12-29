import type { YearlySectionKey } from "@/lib/yearly-constants";

export type ColumnConfig = {
  key: string;
  label: string;
  width: string; // Tailwind width class
  align?: "left" | "right" | "center";
  editable?: boolean;
  derived?: boolean; // For display-only calculated columns
};

// Income columns: Label, Monthly Total (canonical), Each Paycheck (derived = monthly ÷ 2)
export const incomeColumns: ColumnConfig[] = [
  { key: "label", label: "Income Source", width: "min-w-[180px]", align: "left", editable: true },
  { key: "amountCents", label: "Monthly Total", width: "min-w-[120px]", align: "right", editable: true },
  { key: "eachPaycheck", label: "Each Paycheck", width: "min-w-[120px]", align: "right", derived: true },
];

// Monthly Bills columns: Payment To, Due Date, Amount, Payment Source
export const monthlyBillsColumns: ColumnConfig[] = [
  { key: "label", label: "Payment To", width: "min-w-[180px]", align: "left", editable: true },
  { key: "dueDate", label: "Due Date", width: "min-w-[100px]", align: "center", editable: true },
  { key: "amountCents", label: "Amount", width: "min-w-[120px]", align: "right", editable: true },
  { key: "paymentSource", label: "Payment Source", width: "min-w-[140px]", align: "left", editable: true },
];

// Non-Monthly Bills columns: Payment To, Due Date, Amount, Monthly Amount, Payment Source
// Note: Frequency is represented via subsections (Quarterly, Bi-Annual, Annual)
export const nonMonthlyBillsColumns: ColumnConfig[] = [
  { key: "label", label: "Payment To", width: "min-w-[180px]", align: "left", editable: true },
  { key: "dueDate", label: "Due Date", width: "min-w-[140px]", align: "center", editable: true },
  { key: "originalAmountCents", label: "Amount", width: "min-w-[110px]", align: "right", editable: true },
  { key: "amountCents", label: "Monthly", width: "min-w-[110px]", align: "right", derived: true },
  { key: "paymentSource", label: "Payment Source", width: "min-w-[140px]", align: "left", editable: true },
];

// Debt columns: Owed To, Balance, Interest Rate, Monthly Payment, Payment Date, Payment Source
export const debtColumns: ColumnConfig[] = [
  { key: "label", label: "Owed To", width: "min-w-[160px]", align: "left", editable: true },
  { key: "balanceCents", label: "Balance", width: "min-w-[120px]", align: "right", editable: true },
  { key: "interestRate", label: "Interest", width: "min-w-[90px]", align: "right", editable: true },
  { key: "amountCents", label: "Monthly", width: "min-w-[110px]", align: "right", editable: true },
  { key: "dueDate", label: "Date", width: "min-w-[80px]", align: "center", editable: true },
  { key: "paymentSource", label: "Source", width: "min-w-[120px]", align: "left", editable: true },
];

// Savings columns: Allocate To, Current Amount, Goal Amount, Start Month, End Month, Months for Goal, Monthly, Bi-Monthly
export const savingsColumns: ColumnConfig[] = [
  { key: "label", label: "Allocate To", width: "min-w-[160px]", align: "left", editable: true },
  { key: "currentAmountCents", label: "Current", width: "min-w-[110px]", align: "right", editable: true },
  { key: "goalAmountCents", label: "Goal", width: "min-w-[110px]", align: "right", editable: true },
  { key: "startMonth", label: "Start", width: "min-w-[90px]", align: "center", editable: true },
  { key: "endMonth", label: "End", width: "min-w-[90px]", align: "center", editable: true },
  { key: "monthsForGoal", label: "Months", width: "min-w-[70px]", align: "center", derived: true },
  { key: "amountCents", label: "Monthly", width: "min-w-[100px]", align: "right", derived: true },
  { key: "biMonthly", label: "Bi-Mo", width: "min-w-[100px]", align: "right", derived: true },
];

// Investments columns: Allocate To, Monthly, Bi-Monthly, Date, % of Total Income
export const investmentsColumns: ColumnConfig[] = [
  { key: "label", label: "Allocate To", width: "min-w-[160px]", align: "left", editable: true },
  { key: "amountCents", label: "Monthly", width: "min-w-[110px]", align: "right", editable: true },
  { key: "biMonthly", label: "Bi-Mo", width: "min-w-[100px]", align: "right", derived: true },
  { key: "paymentDay", label: "Date", width: "min-w-[80px]", align: "center", editable: true },
  { key: "percentOfIncome", label: "% Income", width: "min-w-[90px]", align: "right", derived: true },
];

// Map section key to column config
export function getColumnsForSection(sectionKey: YearlySectionKey): ColumnConfig[] {
  switch (sectionKey) {
    case "income":
      return incomeColumns;
    case "monthlyBills":
      return monthlyBillsColumns;
    case "nonMonthlyBills":
      return nonMonthlyBillsColumns;
    case "debt":
      return debtColumns;
    case "savings":
      return savingsColumns;
    case "investments":
      return investmentsColumns;
    default:
      return monthlyBillsColumns;
  }
}

// Section titles for display
export const sectionTitles: Record<YearlySectionKey, string> = {
  income: "Income Summary",
  monthlyBills: "Monthly Bills",
  nonMonthlyBills: "Non-Monthly Bills",
  debt: "Debt",
  savings: "Savings",
  investments: "Investments",
};

// Section colors for visual distinction - optimized for contrast in both light and dark modes
export const sectionColors: Record<YearlySectionKey, { bg: string; border: string; text: string }> = {
  income: {
    bg: "bg-emerald-100 dark:bg-emerald-900/50",
    border: "border-emerald-300 dark:border-emerald-700",
    text: "text-emerald-800 dark:text-emerald-200",
  },
  monthlyBills: {
    bg: "bg-rose-100 dark:bg-rose-900/50",
    border: "border-rose-300 dark:border-rose-700",
    text: "text-rose-800 dark:text-rose-200",
  },
  nonMonthlyBills: {
    bg: "bg-amber-100 dark:bg-amber-900/50",
    border: "border-amber-300 dark:border-amber-700",
    text: "text-amber-800 dark:text-amber-200",
  },
  debt: {
    bg: "bg-purple-100 dark:bg-purple-900/50",
    border: "border-purple-300 dark:border-purple-700",
    text: "text-purple-800 dark:text-purple-200",
  },
  savings: {
    bg: "bg-sky-100 dark:bg-sky-900/50",
    border: "border-sky-300 dark:border-sky-700",
    text: "text-sky-800 dark:text-sky-200",
  },
  investments: {
    bg: "bg-indigo-100 dark:bg-indigo-900/50",
    border: "border-indigo-300 dark:border-indigo-700",
    text: "text-indigo-800 dark:text-indigo-200",
  },
};

