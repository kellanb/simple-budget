"use client";

import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { formatCurrency, calculateSavingsMonthly, monthsForGoalInclusive, percentOfIncome } from "@/lib/yearly-calculations";
import type { YearlyLineItem, YearlySectionKey } from "./types";
import { getColumnsForSection } from "./column-definitions";

type YearlyLineItemRowProps = {
  item: YearlyLineItem;
  sectionKey: YearlySectionKey;
  totalIncomeMonthly: number;
  onEdit: () => void;
  onDelete: () => void;
  isDragging?: boolean;
  dragHandleProps?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  style?: React.CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
};

export function YearlyLineItemRow({
  item,
  sectionKey,
  totalIncomeMonthly,
  onEdit,
  onDelete,
  isDragging,
  dragHandleProps,
  dragListeners,
  style,
  setNodeRef,
}: YearlyLineItemRowProps) {
  const columns = getColumnsForSection(sectionKey);

  // Calculate derived values
  const derivedValues = getDerivedValues(item, sectionKey, totalIncomeMonthly);

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
      case "goalAmountCents":
        return item.goalAmountCents ? formatCurrency(item.goalAmountCents) : "—";
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
      ref={setNodeRef}
      style={style}
      className={cn(
        "group transition-colors",
        "border-b border-zinc-100 dark:border-zinc-800",
        "hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70",
        isDragging && "opacity-40 scale-[0.98] bg-blue-50 dark:bg-blue-900/30"
      )}
    >
      {/* Drag handle cell - 44px minimum touch target for mobile */}
      <td className="px-0 border-r border-zinc-100 dark:border-zinc-800">
        <button
          className={cn(
            "flex h-11 w-11 items-center justify-center cursor-grab active:cursor-grabbing touch-none",
            "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 rounded-lg transition-colors",
            "dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-700"
          )}
          {...dragHandleProps}
          {...dragListeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      </td>

      {/* Data cells */}
      {columns.map((col, idx) => (
        <td
          key={col.key}
          className={cn(
            "px-3 py-2 text-sm text-left",
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
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600",
              "dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            )}
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              "text-zinc-400 hover:bg-rose-50 hover:text-rose-600",
              "dark:text-zinc-500 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
            )}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Sortable version of YearlyLineItemRow
type SortableLineItemRowProps = Omit<YearlyLineItemRowProps, 'isDragging' | 'dragHandleProps' | 'dragListeners' | 'style' | 'setNodeRef'>;

export function SortableLineItemRow(props: SortableLineItemRowProps) {
  const { item, sectionKey } = props;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item._id,
    data: { 
      type: "lineItem", 
      sectionKey, 
      subsectionId: item.subsectionId, 
      item 
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <YearlyLineItemRow
      {...props}
      isDragging={isDragging}
      dragHandleProps={attributes}
      dragListeners={listeners}
      style={style}
      setNodeRef={setNodeRef}
    />
  );
}

// Calculate derived values based on section type
function getDerivedValues(
  item: YearlyLineItem,
  sectionKey: YearlySectionKey,
  totalIncomeMonthly: number
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

      // Monthly savings amount
      const monthlySavings = calculateSavingsMonthly({
        ...item,
        sectionKey: item.sectionKey,
      });
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

// Overlay version for drag preview
export function YearlyLineItemRowOverlay({
  item,
  sectionKey,
  totalIncomeMonthly,
}: {
  item: YearlyLineItem;
  sectionKey: YearlySectionKey;
  totalIncomeMonthly: number;
}) {
  const derivedValues = getDerivedValues(item, sectionKey, totalIncomeMonthly);

  const renderCellValue = (columnKey: string) => {
    if (columnKey in derivedValues) {
      return derivedValues[columnKey];
    }
    switch (columnKey) {
      case "label":
        return item.label;
      case "amountCents":
        return formatCurrency(item.amountCents);
      default:
        return "—";
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border-2 border-blue-400 bg-white p-2 shadow-xl",
      "dark:border-blue-500 dark:bg-zinc-900"
    )}>
      <GripVertical className="h-4 w-4 text-blue-500" />
      <span className="font-medium text-zinc-900 dark:text-zinc-50">{item.label}</span>
      <span className="text-zinc-500 dark:text-zinc-400">
        {renderCellValue("amountCents")}
      </span>
    </div>
  );
}

