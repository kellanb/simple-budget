"use client";

import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { formatCurrency, parseMonthYear } from "@/lib/yearly-calculations";
import type { YearlySubsection as YearlySubsectionType, YearlyLineItem, YearlySectionKey, YearlySubsectionSectionKey } from "./types";
import { getColumnsForSection } from "./column-definitions";
import { SortableLineItemRow } from "./yearly-line-item-row";

type YearlySubsectionProps = {
  subsection: YearlySubsectionType;
  sectionKey: YearlySectionKey;
  totalIncomeMonthly: number;
  onEditTitle: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (item: YearlyLineItem) => void;
  onDeleteItem: (item: YearlyLineItem) => void;
  isDragging?: boolean;
  dragHandleProps?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  style?: React.CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
};

export function YearlySubsection({
  subsection,
  sectionKey,
  totalIncomeMonthly,
  onEditTitle,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
  isDragging,
  dragHandleProps,
  dragListeners,
  style,
  setNodeRef,
}: YearlySubsectionProps) {
  const columns = getColumnsForSection(sectionKey);
  
  // Calculate subsection total (depends on section type)
  const subtotal = calculateSubsectionTotal(subsection.items, sectionKey);
  
  // Make the subsection items droppable
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: subsection._id,
    data: { type: "droppableContainer", containerId: subsection._id },
  });

  return (
    <SortableContext
      items={subsection.items.map(i => i._id)}
      strategy={verticalListSortingStrategy}
    >
      <tbody
        ref={(node) => {
          setNodeRef?.(node);
          setDroppableRef(node);
        }}
        style={style}
        className={cn(
          "transition-opacity",
          isDragging && "opacity-40 scale-[0.98]",
          isOver && "bg-blue-100/60 dark:bg-blue-900/30"
        )}
      >
        {/* Subsection header row */}
        <tr className="bg-zinc-100 dark:bg-zinc-800/80 border-t border-b border-zinc-200 dark:border-zinc-700">
          {/* Drag handle - 44px minimum touch target for mobile */}
          <td className="px-0 border-r border-zinc-200 dark:border-zinc-700">
            <button
              className={cn(
                "flex h-11 w-11 items-center justify-center cursor-grab active:cursor-grabbing touch-none",
                "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors",
                "dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
              )}
              {...dragHandleProps}
              {...dragListeners}
            >
              <GripVertical className="h-5 w-5" />
            </button>
          </td>
          <td
            colSpan={columns.length}
            className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-700"
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
          <SortableLineItemRow
            key={item._id}
            item={item}
            sectionKey={sectionKey}
            totalIncomeMonthly={totalIncomeMonthly}
            onEdit={() => onEditItem(item)}
            onDelete={() => onDeleteItem(item)}
          />
        ))}

        {/* Add item row */}
        <tr className="border-b border-zinc-100 dark:border-zinc-800">
          <td className="border-r border-zinc-100 dark:border-zinc-800" />
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
    </SortableContext>
  );
}

// Sortable version of YearlySubsection
type SortableSubsectionProps = Omit<YearlySubsectionProps, 'isDragging' | 'dragHandleProps' | 'dragListeners' | 'style' | 'setNodeRef'>;

export function SortableSubsection(props: SortableSubsectionProps) {
  const { subsection, sectionKey } = props;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: subsection._id,
    data: { 
      type: "subsection", 
      sectionKey: sectionKey as YearlySubsectionSectionKey, 
      subsection 
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <YearlySubsection
      {...props}
      isDragging={isDragging}
      dragHandleProps={attributes}
      dragListeners={listeners}
      style={style}
      setNodeRef={setNodeRef}
    />
  );
}

// Overlay for dragging subsections
export function YearlySubsectionOverlay({ subsection }: { subsection: YearlySubsectionType }) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border-2 border-blue-400 bg-white p-3 shadow-xl",
      "dark:border-blue-500 dark:bg-zinc-900"
    )}>
      <GripVertical className="h-4 w-4 text-blue-500" />
      <span className="font-semibold text-zinc-900 dark:text-zinc-50">{subsection.title}</span>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        ({subsection.items.length} items)
      </span>
    </div>
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

