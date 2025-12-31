"use client";

import { Plus } from "lucide-react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { formatCurrency, percentOfIncome, parseMonthYear } from "@/lib/yearly-calculations";
import type { YearlyLineItem, YearlySubsection as YearlySubsectionType, YearlySectionKey } from "./types";
import { getColumnsForSection, sectionColors, sectionTitles } from "./column-definitions";
import { SortableLineItemRow } from "./yearly-line-item-row";
import { SortableSubsection } from "./yearly-subsection";

// Helper to convert Tailwind width class to CSS width value
function getColumnWidth(tailwindClass: string): string {
  // Extract the value from w-[XXXpx] pattern
  const match = tailwindClass.match(/w-\[(\d+)px\]/);
  if (match) {
    return `${match[1]}px`;
  }
  // Handle standard Tailwind widths
  const standardWidths: Record<string, string> = {
    "w-11": "44px",
    "w-20": "80px",
    "w-28": "112px",
  };
  return standardWidths[tailwindClass] || "auto";
}

type YearlySectionTableProps = {
  sectionKey: YearlySectionKey;
  sectionItems: YearlyLineItem[]; // Items at section level (no subsection)
  subsections: YearlySubsectionType[];
  totalIncomeMonthly: number;
  allItems: YearlyLineItem[]; // All items for computing totals
  onAddSectionItem: () => void;
  onAddSubsection: () => void;
  onEditSubsectionTitle: (subsection: YearlySubsectionType) => void;
  onDeleteSubsection: (subsection: YearlySubsectionType) => void;
  onAddSubsectionItem: (subsection: YearlySubsectionType) => void;
  onEditItem: (item: YearlyLineItem) => void;
  onDeleteItem: (item: YearlyLineItem) => void;
};

export function YearlySectionTable({
  sectionKey,
  sectionItems,
  subsections,
  totalIncomeMonthly,
  allItems,
  onAddSectionItem,
  onAddSubsection,
  onEditSubsectionTitle,
  onDeleteSubsection,
  onAddSubsectionItem,
  onEditItem,
  onDeleteItem,
}: YearlySectionTableProps) {
  const columns = getColumnsForSection(sectionKey);
  const colors = sectionColors[sectionKey];
  const title = sectionTitles[sectionKey];

  // Compute section totals
  const sectionTotal = computeSectionTotal(allItems, sectionKey);
  const percentIncome = totalIncomeMonthly > 0
    ? percentOfIncome(sectionTotal.monthlyCents, totalIncomeMonthly)
    : 0;

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
        <h2 className={cn("text-lg font-bold", colors.text)}>
          {title}
        </h2>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] table-fixed">
          {/* Define column widths for consistent alignment - use inline styles for <col> elements */}
          <colgroup>
            <col style={{ width: "44px" }} />
            {columns.map((col) => (
              <col key={col.key} style={{ width: getColumnWidth(col.width) }} />
            ))}
            <col style={{ width: "112px" }} />
          </colgroup>
          {/* Column headers */}
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/50">
              {/* Drag handle column */}
              <th className="border-r border-zinc-200 dark:border-zinc-700" />
              {columns.map((col, idx) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-left",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    "text-zinc-700 dark:text-zinc-300",
                    // Add subtle vertical border between columns (except last data column)
                    idx < columns.length - 1 && "border-r border-zinc-200 dark:border-zinc-700"
                  )}
                >
                  {col.label}
                </th>
              ))}
              {/* Actions column */}
              <th className="border-l border-zinc-200 dark:border-zinc-700" />
            </tr>
          </thead>

          {/* Section-level items (items without a subsection) */}
          <SortableContext
            items={sectionItems.map(i => i._id)}
            strategy={verticalListSortingStrategy}
          >
            <DroppableSectionItems
              sectionKey={sectionKey}
              sectionItems={sectionItems}
              columns={columns}
              totalIncomeMonthly={totalIncomeMonthly}
              onAddSectionItem={onAddSectionItem}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
            />
          </SortableContext>

          {/* Subsections */}
          <SortableContext
            items={subsections.map(s => s._id)}
            strategy={verticalListSortingStrategy}
          >
            {subsections.map((subsection) => (
              <SortableSubsection
                key={subsection._id}
                subsection={subsection}
                sectionKey={sectionKey}
                totalIncomeMonthly={totalIncomeMonthly}
                onEditTitle={() => onEditSubsectionTitle(subsection)}
                onDelete={() => onDeleteSubsection(subsection)}
                onAddItem={() => onAddSubsectionItem(subsection)}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
              />
            ))}
          </SortableContext>

          {/* Add subsection button */}
          <tbody>
            <tr className="border-t border-b border-zinc-100 dark:border-zinc-800">
              <td className="border-r border-zinc-100 dark:border-zinc-800" />
              <td colSpan={columns.length} className="px-3 py-2">
                <button
                  onClick={onAddSubsection}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors",
                    "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
                    "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Add subsection
                </button>
              </td>
              <td className="border-l border-zinc-100 dark:border-zinc-800" />
            </tr>
          </tbody>

          {/* Section footer with totals */}
          <tfoot>
            <tr className={cn("border-t-2", colors.border, colors.bg)}>
              <td />
              <td
                colSpan={columns.length}
                className="px-3 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className={cn("font-bold text-base", colors.text)}>
                    Total
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                      {sectionTotal.displayText}
                    </span>
                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      {percentIncome.toFixed(1)}% of income
                    </span>
                  </div>
                </div>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Droppable section items container
type DroppableSectionItemsProps = {
  sectionKey: YearlySectionKey;
  sectionItems: YearlyLineItem[];
  columns: ReturnType<typeof getColumnsForSection>;
  totalIncomeMonthly: number;
  onAddSectionItem: () => void;
  onEditItem: (item: YearlyLineItem) => void;
  onDeleteItem: (item: YearlyLineItem) => void;
};

function DroppableSectionItems({
  sectionKey,
  sectionItems,
  columns,
  totalIncomeMonthly,
  onAddSectionItem,
  onEditItem,
  onDeleteItem,
}: DroppableSectionItemsProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${sectionKey}`,
    data: { type: "droppableContainer", containerId: `section-${sectionKey}` },
  });

  return (
    <tbody ref={setNodeRef} className={cn(isOver && "bg-blue-50/50 dark:bg-blue-900/10")}>
      {sectionItems.map((item) => (
        <SortableLineItemRow
          key={item._id}
          item={item}
          sectionKey={sectionKey}
          totalIncomeMonthly={totalIncomeMonthly}
          onEdit={() => onEditItem(item)}
          onDelete={() => onDeleteItem(item)}
        />
      ))}
      {/* Add section-level item button */}
      <tr className="border-b border-zinc-100 dark:border-zinc-800">
        <td className="border-r border-zinc-100 dark:border-zinc-800" />
        <td colSpan={columns.length} className="px-3 py-2">
          <button
            onClick={onAddSectionItem}
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

// Helper to compute section-specific totals
function computeSectionTotal(
  items: YearlyLineItem[],
  sectionKey: YearlySectionKey
): { monthlyCents: number; displayText: string } {
  switch (sectionKey) {
    case "monthlyBills": {
      const total = items.reduce((acc, item) => acc + item.amountCents, 0);
      return { monthlyCents: total, displayText: formatCurrency(total) };
    }

    case "nonMonthlyBills": {
      let annualTotal = 0;
      let monthlyEq = 0;
      for (const item of items) {
        const freq = item.frequency ?? "monthly";
        // Skip irregular frequency items - they can't be calculated for monthly/annual totals
        if (freq === "irregular") continue;
        const original = item.originalAmountCents ?? item.amountCents;
        const perYear: Record<string, number> = { monthly: 12, quarterly: 4, biannual: 2, annual: 1 };
        const annual = original * perYear[freq];
        annualTotal += annual;
        monthlyEq += Math.round(annual / 12);
      }
      return {
        monthlyCents: monthlyEq,
        displayText: `${formatCurrency(annualTotal)}/yr (${formatCurrency(monthlyEq)}/mo)`,
      };
    }

    case "debt": {
      const totalPayment = items.reduce((acc, item) => acc + item.amountCents, 0);
      const totalBalance = items.reduce((acc, item) => acc + (item.balanceCents ?? 0), 0);
      return {
        monthlyCents: totalPayment,
        displayText: `${formatCurrency(totalBalance)} balance | ${formatCurrency(totalPayment)}/mo`,
      };
    }

    case "savings": {
      let totalMonthly = 0;
      let totalGoal = 0;
      let totalCurrent = 0;
      
      for (const item of items) {
        totalGoal += item.goalAmountCents ?? 0;
        totalCurrent += item.currentAmountCents ?? 0;
        
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
      
      return {
        monthlyCents: totalMonthly,
        displayText: `${formatCurrency(totalCurrent)} / ${formatCurrency(totalGoal)} goal | ${formatCurrency(totalMonthly)}/mo`,
      };
    }

    case "investments": {
      const total = items.reduce((acc, item) => acc + item.amountCents, 0);
      return {
        monthlyCents: total,
        displayText: `${formatCurrency(total)}/mo (${formatCurrency(Math.round(total / 2))}/paycheck)`,
      };
    }

    default:
      return { monthlyCents: 0, displayText: "—" };
  }
}

