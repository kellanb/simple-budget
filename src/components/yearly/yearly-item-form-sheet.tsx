"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { YearlyLineItem, YearlySectionKey, LineItemFormValues, Frequency } from "./types";
import { monthlyEquivalentFromOriginal, type SectionTotals, formatCurrency } from "@/lib/yearly-calculations";

type GoalType = "custom" | "6months" | "12months";

type YearlyItemFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LineItemFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  item: YearlyLineItem | null;
  sectionKey: YearlySectionKey;
  sectionTotals?: SectionTotals;
};

// Form field configs per section
const sectionFieldConfigs: Record<YearlySectionKey, string[]> = {
  income: ["label", "amountCents"],
  monthlyBills: ["label", "dueDate", "amountCents", "paymentSource"],
  nonMonthlyBills: ["label", "dueDate", "originalAmountCents", "frequency", "paymentSource"],
  debt: ["label", "balanceCents", "interestRate", "amountCents", "dueDate", "paymentSource"],
  savings: ["label", "currentAmountCents", "goalAmountCents", "startMonth", "endMonth"],
  investments: ["label", "amountCents", "paymentDay"],
};

const frequencyOptions: { value: Frequency; label: string }[] = [
  { value: "quarterly", label: "Quarterly" },
  { value: "biannual", label: "Bi-Annual" },
  { value: "annual", label: "Annual" },
  { value: "irregular", label: "N/A" },
];

export function YearlyItemFormSheet({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  item,
  sectionKey,
  sectionTotals,
}: YearlyItemFormSheetProps) {
  const [form, setForm] = useState<LineItemFormValues>(() => getDefaultValues(item, sectionKey));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>("custom");
  
  // Use ref to track current form values synchronously (avoids async state issues)
  const formRef = useRef<LineItemFormValues>(form);

  // Calculate emergency fund goal amounts (6 and 12 months of expenses)
  // Formula: (Monthly Bills + Debt Payment) * months + Non-Monthly Annual Total
  const calculatedGoals = useMemo(() => {
    if (!sectionTotals) return { sixMonths: 0, twelveMonths: 0 };
    
    const monthlyExpenses = sectionTotals.monthlyBillsMonthly + sectionTotals.debtMonthlyPayment;
    const nonMonthlyAnnual = sectionTotals.nonMonthlyBillsAnnualTotal;
    
    return {
      sixMonths: (monthlyExpenses * 6) + nonMonthlyAnnual,
      twelveMonths: (monthlyExpenses * 12) + nonMonthlyAnnual,
    };
  }, [sectionTotals]);

  // Reset form when item changes
  useEffect(() => {
    if (open) {
      const defaults = getDefaultValues(item, sectionKey);
      setForm(defaults);
      formRef.current = defaults;
      
      // Determine goal type based on existing value
      if (item?.goalAmountCents && sectionKey === "savings" && sectionTotals) {
        const goal = item.goalAmountCents;
        if (goal === calculatedGoals.sixMonths) {
          setGoalType("6months");
        } else if (goal === calculatedGoals.twelveMonths) {
          setGoalType("12months");
        } else {
          setGoalType("custom");
        }
      } else {
        setGoalType("custom");
      }
    }
  }, [open, item, sectionKey, sectionTotals, calculatedGoals]);

  // Update ref immediately (synchronous) and also update state for re-render
  const updateForm = (updater: (prev: LineItemFormValues) => LineItemFormValues) => {
    // Update ref immediately with the new value
    formRef.current = updater(formRef.current);
    // Also update state for re-render
    setForm(formRef.current);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Use ref for the most up-to-date values
    const currentForm = formRef.current;
    if (!currentForm.label.trim()) return;

    // Auto-calculate amountCents for non-monthly bills from originalAmountCents + frequency
    // For "irregular" frequency, we set amountCents to 0 (no monthly calculation)
    let formToSubmit = currentForm;
    if (sectionKey === "nonMonthlyBills" && currentForm.originalAmountCents !== undefined) {
      const frequency = currentForm.frequency ?? "quarterly";
      const monthlyAmount = monthlyEquivalentFromOriginal(currentForm.originalAmountCents, frequency);
      // If irregular, monthlyAmount is null - set to 0 to indicate no monthly calculation
      formToSubmit = { ...currentForm, amountCents: monthlyAmount ?? 0 };
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formToSubmit);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsSubmitting(true);
    try {
      await onDelete();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fields = sectionFieldConfigs[sectionKey];
  const isEditing = item !== null;
  const title = isEditing ? "Edit Item" : "Add Item";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={title}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {fields.includes("label") && (
            <FormField
              label={getLabelForSection(sectionKey)}
              value={form.label}
              onChange={(v) => updateForm((f) => ({ ...f, label: v }))}
              required
            />
          )}

          {fields.includes("amountCents") && (
            <CurrencyField
              label={getAmountLabel(sectionKey)}
              cents={form.amountCents}
              onChangeCents={(cents) => updateForm((f) => ({ ...f, amountCents: cents }))}
            />
          )}

          {fields.includes("originalAmountCents") && (
            <CurrencyField
              label="Amount Per Period"
              cents={form.originalAmountCents ?? 0}
              onChangeCents={(cents) => updateForm((f) => ({ ...f, originalAmountCents: cents }))}
            />
          )}

          {fields.includes("frequency") && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Frequency
              </label>
              <select
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-base sm:text-sm appearance-none",
                  "border-zinc-300 bg-white text-zinc-900",
                  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50",
                  "focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%2318181b%22%20d%3D%22M10.293%203.293L6%207.586%201.707%203.293A1%201%200%2000.293%204.707l5%205a1%201%200%20001.414%200l5-5a1%201%200%2010-1.414-1.414z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_0.75rem_center] bg-no-repeat",
                  "dark:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23fafafa%22%20d%3D%22M10.293%203.293L6%207.586%201.707%203.293A1%201%200%2000.293%204.707l5%205a1%201%200%20001.414%200l5-5a1%201%200%2010-1.414-1.414z%22%2F%3E%3C%2Fsvg%3E')]",
                  "pr-10"
                )}
                value={form.frequency ?? "quarterly"}
                onChange={(e) => updateForm((f) => ({ ...f, frequency: e.target.value as Frequency }))}
              >
                {frequencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {fields.includes("dueDate") && (
            <FormField
              label="Due Date"
              value={form.dueDate ?? ""}
              onChange={(v) => updateForm((f) => ({ ...f, dueDate: v || undefined }))}
              placeholder={sectionKey === "nonMonthlyBills" ? "e.g., 1/20, 4/20, 7/20" : "e.g., 1st, 15th"}
            />
          )}

          {fields.includes("paymentSource") && (
            <FormField
              label="Payment Source"
              value={form.paymentSource ?? ""}
              onChange={(v) => updateForm((f) => ({ ...f, paymentSource: v || undefined }))}
              placeholder="e.g., Chase, Autopay"
            />
          )}

          {fields.includes("balanceCents") && (
            <CurrencyField
              label="Balance"
              cents={form.balanceCents ?? 0}
              onChangeCents={(cents) => updateForm((f) => ({ ...f, balanceCents: cents }))}
            />
          )}

          {fields.includes("interestRate") && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Interest Rate (%)
              </label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.interestRate?.toString() ?? ""}
                onChange={(e) => updateForm((f) => ({ ...f, interestRate: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="e.g., 4.5"
              />
            </div>
          )}

          {fields.includes("currentAmountCents") && (
            <CurrencyField
              label="Current Amount"
              cents={form.currentAmountCents ?? 0}
              onChangeCents={(cents) => updateForm((f) => ({ ...f, currentAmountCents: cents }))}
            />
          )}

          {fields.includes("goalAmountCents") && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Goal Amount
              </label>
              
              {/* Goal type selector */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGoalType("custom");
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    goalType === "custom"
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  )}
                >
                  Custom
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGoalType("6months");
                    updateForm((f) => ({ ...f, goalAmountCents: calculatedGoals.sixMonths }));
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    goalType === "6months"
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  )}
                >
                  6 Mo. Expenses
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGoalType("12months");
                    updateForm((f) => ({ ...f, goalAmountCents: calculatedGoals.twelveMonths }));
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    goalType === "12months"
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  )}
                >
                  12 Mo. Expenses
                </button>
              </div>

              {/* Show calculated amounts for reference */}
              {goalType !== "custom" && sectionTotals && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {goalType === "6months" 
                    ? `Based on: (${formatCurrency(sectionTotals.monthlyBillsMonthly)} bills + ${formatCurrency(sectionTotals.debtMonthlyPayment)} debt) × 6 + ${formatCurrency(sectionTotals.nonMonthlyBillsAnnualTotal)} non-monthly`
                    : `Based on: (${formatCurrency(sectionTotals.monthlyBillsMonthly)} bills + ${formatCurrency(sectionTotals.debtMonthlyPayment)} debt) × 12 + ${formatCurrency(sectionTotals.nonMonthlyBillsAnnualTotal)} non-monthly`
                  }
                </p>
              )}

              {/* Currency input - only editable when custom */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                {goalType === "custom" ? (
                  <Input
                    value={form.goalAmountCents ? centsToDisplay(form.goalAmountCents) : ""}
                    onChange={(e) => {
                      const cents = toCents(e.target.value);
                      updateForm((f) => ({ ...f, goalAmountCents: cents }));
                    }}
                    inputMode="decimal"
                    className="pl-7"
                    placeholder="0.00"
                  />
                ) : (
                  <Input
                    value={centsToDisplay(form.goalAmountCents ?? 0)}
                    readOnly
                    className="pl-7 bg-zinc-50 dark:bg-zinc-800/50 cursor-not-allowed"
                  />
                )}
              </div>
            </div>
          )}

          {fields.includes("startMonth") && (
            <FormField
              label="Start Month"
              value={form.startMonth ?? ""}
              onChange={(v) => updateForm((f) => ({ ...f, startMonth: v || undefined }))}
              placeholder="e.g., Jan 2026"
            />
          )}

          {fields.includes("endMonth") && (
            <FormField
              label="End Month"
              value={form.endMonth ?? ""}
              onChange={(v) => updateForm((f) => ({ ...f, endMonth: v || undefined }))}
              placeholder="e.g., Dec 2026"
            />
          )}

          {fields.includes("paymentDay") && (
            <FormField
              label="Payment Day"
              value={form.paymentDay ?? ""}
              onChange={(v) => updateForm((f) => ({ ...f, paymentDay: v || undefined }))}
              placeholder="e.g., 16th"
            />
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-2">
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                className="text-rose-600 hover:bg-rose-50"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Delete
              </Button>
            )}
            <Button
              type="submit"
              className="ml-auto"
              disabled={!form.label.trim() || isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// Helper components and functions

function FormField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

// Currency input that keeps the raw string while typing and converts on blur
function CurrencyField({
  label,
  cents,
  onChangeCents,
}: {
  label: string;
  cents: number;
  onChangeCents: (cents: number) => void;
}) {
  // Local editing value - null means we're showing the prop-derived value
  const [localValue, setLocalValue] = useState<string | null>(null);

  // Display either the local editing value or the derived value from cents prop
  const displayValue = localValue !== null ? localValue : centsToDisplay(cents);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Filter to valid currency characters but preserve intermediate states like "100." or "100.5"
    const filtered = raw.replace(/[^0-9.-]/g, "");
    setLocalValue(filtered);
    // Also update parent with current conversion (so form submit works without blur)
    onChangeCents(toCents(filtered));
  };

  const handleBlur = () => {
    if (localValue !== null) {
      // Reset to derived mode - parent already has the value from handleChange
      setLocalValue(null);
    }
  };

  const handleFocus = () => {
    // Start editing with current display value
    setLocalValue(displayValue);
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
        <Input
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          inputMode="decimal"
          className="pl-7"
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

function getDefaultValues(item: YearlyLineItem | null, sectionKey: YearlySectionKey): LineItemFormValues {
  if (item) {
    return {
      label: item.label,
      amountCents: item.amountCents,
      note: item.note,
      paymentSource: item.paymentSource,
      dueDate: item.dueDate,
      frequency: item.frequency,
      originalAmountCents: item.originalAmountCents,
      balanceCents: item.balanceCents,
      interestRate: item.interestRate,
      goalAmountCents: item.goalAmountCents,
      currentAmountCents: item.currentAmountCents,
      startMonth: item.startMonth,
      endMonth: item.endMonth,
      paymentDay: item.paymentDay,
    };
  }

  // Default values based on section
  const defaults: LineItemFormValues = {
    label: "",
    amountCents: 0,
  };

  if (sectionKey === "nonMonthlyBills") {
    defaults.frequency = "quarterly";
  }

  return defaults;
}

function getLabelForSection(sectionKey: YearlySectionKey): string {
  switch (sectionKey) {
    case "income":
      return "Income Source";
    case "monthlyBills":
    case "nonMonthlyBills":
      return "Payment To";
    case "debt":
      return "Owed To";
    case "savings":
    case "investments":
      return "Allocate To";
    default:
      return "Label";
  }
}

function getAmountLabel(sectionKey: YearlySectionKey): string {
  switch (sectionKey) {
    case "income":
      return "Monthly Amount";
    case "debt":
      return "Monthly Payment";
    case "investments":
      return "Monthly Contribution";
    default:
      return "Amount";
  }
}

// Convert cents to display string (e.g., 10032 -> "100.32", 0 -> "")
function centsToDisplay(cents: number): string {
  if (cents === 0) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

// Convert display string to cents (e.g., "100.32" -> 10032)
function toCents(value: string): number {
  const numeric = parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (isNaN(numeric)) return 0;
  return Math.round(numeric * 100);
}

