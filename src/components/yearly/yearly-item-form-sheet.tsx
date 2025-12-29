"use client";

import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { YearlyLineItem, YearlySectionKey, LineItemFormValues, Frequency } from "./types";
import { monthlyEquivalentFromOriginal } from "@/lib/yearly-calculations";

type YearlyItemFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LineItemFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  item: YearlyLineItem | null;
  sectionKey: YearlySectionKey;
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
];

export function YearlyItemFormSheet({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  item,
  sectionKey,
}: YearlyItemFormSheetProps) {
  const [form, setForm] = useState<LineItemFormValues>(() => getDefaultValues(item, sectionKey));
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Use ref to track current form values synchronously (avoids async state issues)
  const formRef = useRef<LineItemFormValues>(form);

  // Reset form when item changes
  useEffect(() => {
    if (open) {
      const defaults = getDefaultValues(item, sectionKey);
      setForm(defaults);
      formRef.current = defaults;
    }
  }, [open, item, sectionKey]);

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
    let formToSubmit = currentForm;
    if (sectionKey === "nonMonthlyBills" && currentForm.originalAmountCents !== undefined) {
      const frequency = currentForm.frequency ?? "quarterly";
      const monthlyAmount = monthlyEquivalentFromOriginal(currentForm.originalAmountCents, frequency);
      formToSubmit = { ...currentForm, amountCents: monthlyAmount };
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
                  "w-full rounded-xl border px-3 py-2 text-base sm:text-sm",
                  "border-zinc-300 bg-white text-zinc-900",
                  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50",
                  "focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
            <FormField
              label="Interest Rate (%)"
              value={form.interestRate?.toString() ?? ""}
              onChange={(v) => updateForm((f) => ({ ...f, interestRate: v ? parseFloat(v) : undefined }))}
              placeholder="e.g., 4.5"
            />
          )}

          {fields.includes("currentAmountCents") && (
            <CurrencyField
              label="Current Amount"
              cents={form.currentAmountCents ?? 0}
              onChangeCents={(cents) => updateForm((f) => ({ ...f, currentAmountCents: cents }))}
            />
          )}

          {fields.includes("goalAmountCents") && (
            <CurrencyField
              label="Goal Amount"
              cents={form.goalAmountCents ?? 0}
              onChangeCents={(cents) => updateForm((f) => ({ ...f, goalAmountCents: cents }))}
            />
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

