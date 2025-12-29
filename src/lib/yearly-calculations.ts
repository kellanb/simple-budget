// Type definitions for yearly calculations
export type Frequency = "monthly" | "quarterly" | "biannual" | "annual" | "irregular";

export type YearlyLineItem = {
  _id: string;
  sectionKey: string;
  subsectionId?: string;
  label: string;
  amountCents: number;
  order: number;
  note?: string;
  paymentSource?: string;
  dueDate?: string;
  frequency?: Frequency;
  originalAmountCents?: number;
  balanceCents?: number;
  interestRate?: number;
  goalAmountCents?: number;
  currentAmountCents?: number;
  startMonth?: string;
  endMonth?: string;
  paymentDay?: string;
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
// Returns null for irregular frequency (no monthly calculation possible)
export function paymentsPerYear(frequency: Frequency): number | null {
  switch (frequency) {
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "biannual":
      return 2;
    case "annual":
      return 1;
    case "irregular":
      return null; // Cannot calculate monthly - unpredictable frequency
  }
}

// Non-monthly: user enters `originalAmountCents` as the amount billed per period (quarter/half-year/year).
// Returns null for irregular frequency (cannot calculate annual total)
export function annualTotalFromOriginal(
  originalAmountCents: number,
  frequency: Frequency
): number | null {
  const payments = paymentsPerYear(frequency);
  if (payments === null) return null; // Irregular - cannot calculate
  return originalAmountCents * payments;
}

// Returns null for irregular frequency (cannot calculate monthly equivalent)
export function monthlyEquivalentFromOriginal(
  originalAmountCents: number,
  frequency: Frequency
): number | null {
  // Example: quarterly -> amount * 4 / 12, biannual -> amount * 2 / 12, annual -> amount * 1 / 12
  const annual = annualTotalFromOriginal(originalAmountCents, frequency);
  if (annual === null) return null; // Irregular - cannot calculate
  return Math.round(annual / 12);
}

// Parse month+year strings like "Jan 2026" or "January 2026"
export function parseMonthYear(monthYear: string): { month: number; year: number } | null {
  const monthNames: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  const parts = monthYear.trim().toLowerCase().split(/\s+/);
  if (parts.length !== 2) return null;

  const monthStr = parts[0];
  const yearStr = parts[1];

  const month = monthNames[monthStr];
  const year = parseInt(yearStr, 10);

  if (month === undefined || isNaN(year)) return null;

  return { month, year };
}

// Savings: month+year strings like "Jan 2026" and "Dec 2027" (inclusive; can span multiple years).
export function monthsForGoalInclusive(
  startMonth: string,
  endMonth: string
): number | null {
  const start = parseMonthYear(startMonth);
  const end = parseMonthYear(endMonth);

  if (!start || !end) return null;

  // Calculate total months (inclusive)
  const startTotal = start.year * 12 + start.month;
  const endTotal = end.year * 12 + end.month;

  if (endTotal < startTotal) return null;

  return endTotal - startTotal + 1; // +1 for inclusive
}

// Calculate savings monthly amount
export function calculateSavingsMonthly(item: YearlyLineItem): number | null {
  const goalAmountCents = item.goalAmountCents ?? 0;
  const currentAmountCents = item.currentAmountCents ?? 0;

  // Goal already met
  if (currentAmountCents >= goalAmountCents) return null;

  // Missing dates
  if (!item.startMonth || !item.endMonth) return null;

  const months = monthsForGoalInclusive(item.startMonth, item.endMonth);
  if (months === null || months <= 0) return null;

  const remaining = goalAmountCents - currentAmountCents;
  return Math.round(remaining / months);
}

// Sum items by section (already normalized to monthly)
export function computeSectionTotals(items: YearlyLineItem[]): SectionTotals {
  let incomeMonthly = 0;
  let monthlyBillsMonthly = 0;
  let nonMonthlyBillsMonthlyEq = 0;
  let nonMonthlyBillsAnnualTotal = 0;
  let debtMonthlyPayment = 0;
  let debtBalanceTotal = 0;
  let savingsMonthly = 0;
  let savingsGoalTotal = 0;
  let savingsCurrentTotal = 0;
  let investmentsMonthly = 0;

  for (const item of items) {
    switch (item.sectionKey) {
      case "income":
        incomeMonthly += item.amountCents;
        break;

      case "monthlyBills":
        monthlyBillsMonthly += item.amountCents;
        break;

      case "nonMonthlyBills": {
        const freq = item.frequency ?? "monthly";
        const original = item.originalAmountCents ?? item.amountCents;
        const annual = annualTotalFromOriginal(original, freq);
        const monthly = monthlyEquivalentFromOriginal(original, freq);
        // Skip irregular frequency items (cannot calculate monthly/annual)
        if (annual !== null) nonMonthlyBillsAnnualTotal += annual;
        if (monthly !== null) nonMonthlyBillsMonthlyEq += monthly;
        break;
      }

      case "debt":
        debtMonthlyPayment += item.amountCents;
        debtBalanceTotal += item.balanceCents ?? 0;
        break;

      case "savings": {
        const monthly = calculateSavingsMonthly(item);
        if (monthly !== null) {
          savingsMonthly += monthly;
        }
        savingsGoalTotal += item.goalAmountCents ?? 0;
        savingsCurrentTotal += item.currentAmountCents ?? 0;
        break;
      }

      case "investments":
        investmentsMonthly += item.amountCents;
        break;
    }
  }

  return {
    incomeMonthly,
    incomeEachPaycheckDisplay: Math.round(incomeMonthly / 2),
    monthlyBillsMonthly,
    nonMonthlyBillsMonthlyEq,
    nonMonthlyBillsAnnualTotal,
    debtMonthlyPayment,
    debtBalanceTotal,
    savingsMonthly,
    savingsBiMonthly: Math.round(savingsMonthly / 2),
    savingsGoalTotal,
    savingsCurrentTotal,
    investmentsMonthly,
    investmentsBiMonthly: Math.round(investmentsMonthly / 2),
  };
}

// Calculate "After X" ladder
export function computeIncomeBreakdown(totals: SectionTotals): IncomeBreakdown {
  const totalIncomeMonthly = totals.incomeMonthly;
  const afterMonthlyBills = totalIncomeMonthly - totals.monthlyBillsMonthly;
  const afterNonMonthlyBills = afterMonthlyBills - totals.nonMonthlyBillsMonthlyEq;
  const afterDebt = afterNonMonthlyBills - totals.debtMonthlyPayment;
  const afterSavings = afterDebt - totals.savingsMonthly;
  const afterInvestments = afterSavings - totals.investmentsMonthly;

  return {
    totalIncomeMonthly,
    afterMonthlyBills,
    afterNonMonthlyBills,
    afterDebt,
    afterSavings,
    afterInvestments,
  };
}

// Percentage helper
export function percentOfIncome(amountCents: number, totalIncome: number): number {
  if (totalIncome === 0) return 0;
  return Math.round((amountCents / totalIncome) * 100 * 100) / 100; // Two decimal places
}

// Format currency helper
export function formatCurrency(cents: number, currency = "USD"): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return formatter.format(cents / 100);
}

// Format month string for display (e.g., "Jan 2026")
export function formatMonthDisplay(monthYear: string | undefined): string {
  if (!monthYear) return "—";
  const parsed = parseMonthYear(monthYear);
  if (!parsed) return monthYear;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[parsed.month]} ${parsed.year}`;
}

