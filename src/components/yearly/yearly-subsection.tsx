"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, parseMonthYear, type SectionTotals } from "@/lib/yearly-calculations";
import type { YearlySubsection as YearlySubsectionType, YearlyLineItem, YearlySectionKey } from "./types";
import { getColumnsForSection } from "./column-definitions";
import { YearlyLineItemRow } from "./yearly-line-item-row";

type YearlySubsectionProps = {
  subsection: YearlySubsectionType;
  sectionKey: YearlySectionKey;
  totalIncomeMonthly: number;
  sectionTotals?: SectionTotals;
  onEditTitle: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: YearlyLineItem) => void;
  onDeleteItem: (item: YearlyLineItem) => void;
};

export function YearlySubsection({
  subsection,
  sectionKey,
  totalIncomeMonthly,
  sectionTotals,
  onEditTitle,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: YearlySubsectionProps) {
  const columns = getColumnsForSection(sectionKey);
  
  // Calculate subsection total (depends on section type)
  const subtotal = calculateSubsectionTotal(subsection.items, sectionKey);

  return (
    <tbody>
      {/* Subsection header row */}
      <tr className="bg-zinc-100 dark:bg-zinc-800/80 border-t border-b border-zinc-200 dark:border-zinc-700">
        <td
          colSpan={columns.length}
          className="pl-5 pr-3 py-2 border-r border-zinc-200 dark:border-zinc-700"
        >
          <div className="flex items-center gap-3">
            <span className="font-bold text-zinc-800 dark:text-zinc-100">
              {subsection.title}
            </span>
            <button
              onClick={onEditTitle}
              className={cn(
                "rounded-lg p-2 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center",
                "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700",
                "dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              )}
              aria-label="Edit subsection title"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className={cn(
                "rounded-lg p-2 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center",
                "text-zinc-500 hover:bg-rose-100 hover:text-rose-600",
                "dark:text-zinc-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
              )}
              aria-label="Delete subsection"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <span className="ml-auto text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              {subtotal}
            </span>
          </div>
        </td>
        <td />
      </tr>

      {/* Subsection items */}
      {subsection.items.map((item) => (
        <YearlyLineItemRow
          key={item._id}
          item={item}
          sectionKey={sectionKey}
          totalIncomeMonthly={totalIncomeMonthly}
          sectionTotals={sectionTotals}
          onEdit={() => onEditItem(item)}
          onDelete={() => onDeleteItem(item)}
        />
      ))}

      {/* Add item row */}
      <tr className="border-b border-zinc-100 dark:border-zinc-800">
        <td colSpan={columns.length} className="px-3 py-2">
          <button
            onClick={onAddItem}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors",
              "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600",
              "dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Add item
          </button>
        </td>
        <td className="border-l border-zinc-100 dark:border-zinc-800" />
      </tr>
    </tbody>
  );
}

function calculateSubsectionTotal(items: YearlyLineItem[], sectionKey: YearlySectionKey): string {
  if (items.length === 0) return "—";

  switch (sectionKey) {
    case "monthlyBills":
    case "investments": {
      const total = items.reduce((acc, item) => acc + item.amountCents, 0);
      return formatCurrency(total);
    }
    case "nonMonthlyBills": {
      // Show monthly equivalent (skip irregular items - they can't be calculated)
      const monthlyEq = items.reduce((acc, item) => {
        const freq = item.frequency ?? "monthly";
        if (freq === "irregular") return acc; // Skip irregular - no monthly calculation
        const original = item.originalAmountCents ?? item.amountCents;
        const paymentsPerYear: Record<string, number> = {
          monthly: 12,
          quarterly: 4,
          biannual: 2,
          annual: 1,
        };
        return acc + Math.round((original * paymentsPerYear[freq]) / 12);
      }, 0);
      return formatCurrency(monthlyEq) + "/mo";
    }
    case "debt": {
      const totalPayment = items.reduce((acc, item) => acc + item.amountCents, 0);
      return formatCurrency(totalPayment) + "/mo";
    }
    case "savings": {
      // Calculate total monthly savings
      let totalMonthly = 0;
      for (const item of items) {
        const goalAmount = item.goalAmountCents ?? 0;
        const currentAmount = item.currentAmountCents ?? 0;
        if (currentAmount >= goalAmount) continue;
        if (!item.startMonth || !item.endMonth) continue;
        
        const start = parseMonthYear(item.startMonth);
        const end = parseMonthYear(item.endMonth);
        if (!start || !end) continue;
        
        const months = (end.year * 12 + end.month) - (start.year * 12 + start.month) + 1;
        if (months <= 0) continue;
        
        totalMonthly += Math.round((goalAmount - currentAmount) / months);
      }
      return formatCurrency(totalMonthly) + "/mo";
    }
    default:
      return "—";
  }
}

