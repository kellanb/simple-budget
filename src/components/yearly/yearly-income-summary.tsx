"use client";

import { ArrowUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, percentOfIncome } from "@/lib/yearly-calculations";
import type { YearlyLineItem } from "./types";
import type { IncomeBreakdown, SectionTotals } from "@/lib/yearly-calculations";
import { sectionColors } from "./column-definitions";

type YearlyIncomeSummaryProps = {
  incomeItems: YearlyLineItem[];
  totals: SectionTotals;
  breakdown: IncomeBreakdown;
  onAddItem: () => void;
  onEditItem: (item: YearlyLineItem) => void;
  onDeleteItem: (item: YearlyLineItem) => void;
  onReorder: () => void;
};

export function YearlyIncomeSummary({
  incomeItems,
  totals,
  breakdown,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onReorder,
}: YearlyIncomeSummaryProps) {
  const colors = sectionColors.income;

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden",
        colors.border,
        "bg-white dark:bg-zinc-900"
      )}
      data-zoom-target="section"
    >
      {/* Section header */}
      <div className={cn("px-4 py-3", colors.bg)}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={cn("text-lg font-bold", colors.text)}>
            Income Summary
          </h2>
          <button
            onClick={onReorder}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all shadow-sm",
              "hover:shadow-md hover:brightness-95 dark:hover:brightness-110",
              colors.bg,
              colors.border,
              colors.text
            )}
          >
            <ArrowUpDown className="h-4 w-4" />
            Reorder
          </button>
        </div>
      </div>

      {/* Income items table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] table-fixed">
          <colgroup>
            <col style={{ width: "45%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "110px" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/50">
              <th className={cn(
                "px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider",
                "text-zinc-700 dark:text-zinc-300"
              )}>
                Income Source
              </th>
              <th className={cn(
                "px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider",
                "text-zinc-700 dark:text-zinc-300"
              )}>
                Monthly Total
              </th>
              <th className={cn(
                "px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider",
                "text-zinc-700 dark:text-zinc-300"
              )}>
                Each Paycheck
              </th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {incomeItems.map((item) => (
              <IncomeRow
                key={item._id}
                item={item}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
              />
            ))}

            {/* Add income item row */}
            <tr>
              <td colSpan={3} className="px-3 py-2">
                <button
                  onClick={onAddItem}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors",
                    "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600",
                    "dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add income
                </button>
              </td>
              <td className="w-28" />
            </tr>
          </tbody>

          {/* Totals section */}
          <tfoot>
            {/* Total Income row */}
            <tr className="border-t-2 border-emerald-300 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/50">
              <td className="pl-5 pr-3 py-3 font-bold text-base text-emerald-800 dark:text-emerald-200">
                Total Income
              </td>
              <td className="px-3 py-3 text-right font-bold text-base text-emerald-800 dark:text-emerald-200">
                {formatCurrency(totals.incomeMonthly)}
              </td>
              <td className="px-3 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-300 italic">
                {formatCurrency(totals.incomeEachPaycheckDisplay)}
              </td>
              <td className="w-28" />
            </tr>

            {/* Divider */}
            <tr>
              <td colSpan={4} className="h-2" />
            </tr>

            {/* After X breakdown rows */}
            <AfterRow
              label="After Monthly Bills"
              amount={breakdown.afterMonthlyBills}
              totalIncome={breakdown.totalIncomeMonthly}
            />
            <AfterRow
              label="After Non-Monthly Bills"
              amount={breakdown.afterNonMonthlyBills}
              totalIncome={breakdown.totalIncomeMonthly}
            />
            <AfterRow
              label="After Debt"
              amount={breakdown.afterDebt}
              totalIncome={breakdown.totalIncomeMonthly}
            />
            <AfterRow
              label="After Savings"
              amount={breakdown.afterSavings}
              totalIncome={breakdown.totalIncomeMonthly}
            />
            <AfterRow
              label="After Investments"
              amount={breakdown.afterInvestments}
              totalIncome={breakdown.totalIncomeMonthly}
              isLast
            />
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Income row component (non-sortable)
function IncomeRow({
  item,
  onEditItem,
  onDeleteItem,
}: {
  item: YearlyLineItem;
  onEditItem: (item: YearlyLineItem) => void;
  onDeleteItem: (item: YearlyLineItem) => void;
}) {
  return (
    <tr
      className={cn(
        "group hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 transition-colors"
      )}
    >
      <td className="pl-5 pr-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        {item.label}
      </td>
      <td className="px-3 py-2 text-sm text-right font-semibold text-emerald-700 dark:text-emerald-300">
        {formatCurrency(item.amountCents)}
      </td>
      <td className="px-3 py-2 text-sm text-right text-zinc-600 dark:text-zinc-400 italic">
        {formatCurrency(Math.round(item.amountCents / 2))}
      </td>
      {/* Action buttons - always visible for mobile accessibility */}
      <td className="w-28 px-2">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEditItem(item)}
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
            onClick={() => onDeleteItem(item)}
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

function AfterRow({
  label,
  amount,
  totalIncome,
  isLast,
}: {
  label: string;
  amount: number;
  totalIncome: number;
  isLast?: boolean;
}) {
  const pct = totalIncome > 0 ? percentOfIncome(amount, totalIncome) : 0;
  const isNegative = amount < 0;

  return (
    <tr className={cn(
      "hover:bg-zinc-50 dark:hover:bg-zinc-800/30",
      isLast && "border-b-0"
    )}>
      <td className="pl-5 pr-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </td>
      <td className={cn(
        "px-3 py-2 text-right text-sm font-semibold",
        isNegative
          ? "text-rose-700 dark:text-rose-300"
          : "text-zinc-800 dark:text-zinc-200"
      )}>
        {formatCurrency(amount)}
      </td>
      <td className="px-3 py-2 text-right text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {pct.toFixed(1)}%
      </td>
      <td className="w-28" />
    </tr>
  );
}

