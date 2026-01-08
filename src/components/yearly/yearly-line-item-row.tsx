"use client";

import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, calculateSavingsMonthly, monthsForGoalInclusive, percentOfIncome, type SectionTotals } from "@/lib/yearly-calculations";
import type { YearlyLineItem, YearlySectionKey } from "./types";
import { getColumnsForSection } from "./column-definitions";

type YearlyLineItemRowProps = {
  item: YearlyLineItem;
  sectionKey: YearlySectionKey;
  totalIncomeMonthly: number;
  sectionTotals?: SectionTotals;
  onEdit: () => void;
  onDelete: () => void;
};

export function YearlyLineItemRow({
  item,
  sectionKey,
  totalIncomeMonthly,
  sectionTotals,
  onEdit,
  onDelete,
}: YearlyLineItemRowProps) {
  const columns = getColumnsForSection(sectionKey);

  // Calculate derived values - pass sectionTotals for savings calculations
  const derivedValues = getDerivedValues(item, sectionKey, totalIncomeMonthly, sectionTotals);
  
  // Calculate dynamic goal amount for savings items with non-custom goal types
  const getGoalAmount = () => {
    if (sectionKey !== "savings" || !sectionTotals || !item.goalAmountType || item.goalAmountType === "custom") {
      return item.goalAmountCents;
    }
    
    // Calculate goal based on type
    const monthlyExpenses = sectionTotals.monthlyBillsMonthly + sectionTotals.debtMonthlyPayment;
    const nonMonthlyAnnual = sectionTotals.nonMonthlyBillsAnnualTotal;
    
    if (item.goalAmountType === "6months") {
      return (monthlyExpenses * 6) + nonMonthlyAnnual;
    } else if (item.goalAmountType === "12months") {
      return (monthlyExpenses * 12) + nonMonthlyAnnual;
    }
    
    return item.goalAmountCents;
  };

  const renderCellValue = (columnKey: string) => {
    // Handle derived columns
    if (columnKey in derivedValues) {
      return derivedValues[columnKey];
    }

    // Handle regular columns - text wraps naturally now
    switch (columnKey) {
      case "label":
        return item.label || "—";
      case "amountCents":
        // For non-monthly bills with irregular frequency, show "N/A" instead of $0
        if (sectionKey === "nonMonthlyBills" && item.frequency === "irregular") {
          return "N/A";
        }
        return formatCurrency(item.amountCents);
      case "dueDate":
        return item.dueDate || "—";
      case "paymentSource":
        return item.paymentSource || "—";
      case "originalAmountCents":
        return item.originalAmountCents ? formatCurrency(item.originalAmountCents) : formatCurrency(item.amountCents);
      case "balanceCents":
        return item.balanceCents ? formatCurrency(item.balanceCents) : "—";
      case "interestRate":
        return item.interestRate !== undefined ? `${item.interestRate}%` : "—";
      case "goalAmountCents": {
        const goalAmount = getGoalAmount();
        return goalAmount ? formatCurrency(goalAmount) : "—";
      }
      case "currentAmountCents":
        return item.currentAmountCents !== undefined ? formatCurrency(item.currentAmountCents) : "—";
      case "startMonth":
        return item.startMonth || "—";
      case "endMonth":
        return item.endMonth || "—";
      case "paymentDay":
        return item.paymentDay || "—";
      default:
        return "—";
    }
  };

  return (
    <tr
      className={cn(
        "group transition-colors",
        "border-b border-zinc-100 dark:border-zinc-800",
        "hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
      )}
    >
      {/* Data cells */}
      {columns.map((col, idx) => (
        <td
          key={col.key}
          className={cn(
            "py-2 text-sm text-left",
            // Add extra left padding for the first column (label) to create space from section edge
            idx === 0 ? "pl-5 pr-3" : "px-3",
            // Allow text wrapping for text-based columns, nowrap for numeric/derived
            col.key === "label" || col.key === "paymentSource" || col.key === "dueDate"
              ? "break-words"
              : "whitespace-nowrap",
            col.align === "right" && "text-right",
            col.align === "center" && "text-center",
            col.derived 
              ? "text-zinc-600 dark:text-zinc-400 italic" 
              : "text-zinc-800 dark:text-zinc-200",
            // Add subtle vertical border between columns (except last data column)
            idx < columns.length - 1 && "border-r border-zinc-100 dark:border-zinc-800"
          )}
        >
          {renderCellValue(col.key)}
        </td>
      ))}

      {/* Action buttons cell - always visible for mobile accessibility */}
      <td className="px-2 border-l border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onEdit}
            className={cn(
              "rounded-lg p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
              "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600",
              "dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            )}
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className={cn(
              "rounded-lg p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
              "text-zinc-400 hover:bg-rose-50 hover:text-rose-600",
              "dark:text-zinc-500 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
            )}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Calculate derived values based on section type
function getDerivedValues(
  item: YearlyLineItem,
  sectionKey: YearlySectionKey,
  totalIncomeMonthly: number,
  sectionTotals?: SectionTotals
): Record<string, string> {
  const derived: Record<string, string> = {};

  switch (sectionKey) {
    case "income":
      // Each paycheck = monthly / 2
      derived.eachPaycheck = formatCurrency(Math.round(item.amountCents / 2));
      break;

    case "savings": {
      // Months for goal
      if (item.startMonth && item.endMonth) {
        const months = monthsForGoalInclusive(item.startMonth, item.endMonth);
        derived.monthsForGoal = months !== null ? months.toString() : "—";
      } else {
        derived.monthsForGoal = "—";
      }

      // Monthly savings amount - pass sectionTotals for dynamic goal calculation
      const monthlySavings = calculateSavingsMonthly(
        { ...item, sectionKey: item.sectionKey },
        sectionTotals
      );
      if (monthlySavings !== null) {
        derived.amountCents = formatCurrency(monthlySavings);
        derived.biMonthly = formatCurrency(Math.round(monthlySavings / 2));
      } else {
        derived.amountCents = "—";
        derived.biMonthly = "—";
      }
      break;
    }

    case "investments":
      // Bi-monthly = monthly / 2
      derived.biMonthly = formatCurrency(Math.round(item.amountCents / 2));
      // Percent of income
      derived.percentOfIncome =
        totalIncomeMonthly > 0
          ? `${percentOfIncome(item.amountCents, totalIncomeMonthly).toFixed(1)}%`
          : "—";
      break;
  }

  return derived;
}

