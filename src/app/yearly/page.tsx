"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { Loader2, AlertCircle, Copy } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "@/components/auth/auth-context";
import { Navbar } from "@/components/ui/navbar";
import { SpreadsheetContainer } from "@/components/yearly/spreadsheet-container";
import { YearSelector } from "@/components/yearly/year-selector";
import { YearlyIncomeSummary } from "@/components/yearly/yearly-income-summary";
import { YearlySectionTable } from "@/components/yearly/yearly-section-table";
import { YearlyItemFormSheet } from "@/components/yearly/yearly-item-form-sheet";
import { YearlySubsectionFormSheet } from "@/components/yearly/yearly-subsection-form-sheet";
import { YearlyReorderSheet } from "@/components/yearly/yearly-reorder-sheet";
import { computeSectionTotals, computeIncomeBreakdown } from "@/lib/yearly-calculations";
import type { YearlyLineItem, YearlySubsection, YearlySectionKey, YearlySubsectionSectionKey, LineItemFormValues, SubsectionFormValues } from "@/components/yearly/types";
import { YEARLY_SUBSECTION_SECTION_DEFS } from "@/lib/yearly-constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function YearlyPage() {
  const { user, isLoading: isAuthLoading, signOut } = useAuth();

  // Year state (default to current year)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Data fetching
  const yearlyData = useQuery(
    api.yearly.listForYear,
    user ? { token: user.token, year: selectedYear } : "skip"
  );

  // Fetch years that have data (for copy feature)
  const yearsWithData = useQuery(
    api.yearly.listYearsWithData,
    user ? { token: user.token } : "skip"
  );

  // Mutations
  const createSubsection = useMutation(api.yearly.createSubsection);
  const updateSubsection = useMutation(api.yearly.updateSubsection);
  const removeSubsection = useMutation(api.yearly.removeSubsection);
  const reorderSubsections = useMutation(api.yearly.reorderSubsections);
  const createLineItem = useMutation(api.yearly.createLineItem);
  const updateLineItem = useMutation(api.yearly.updateLineItem);
  const removeLineItem = useMutation(api.yearly.removeLineItem);
  const reorderLineItems = useMutation(api.yearly.reorderLineItems);
  const moveLineItem = useMutation(api.yearly.moveLineItem);
  const copyFromYear = useMutation(api.yearly.copyFromYear);

  // Copy from year modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false);

  // Reorder sheet state
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderSectionKey, setReorderSectionKey] = useState<YearlySectionKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openReorderSheet = useCallback((sectionKey: YearlySectionKey) => {
    setReorderSectionKey(sectionKey);
    setReorderOpen(true);
  }, []);

  const closeReorderSheet = useCallback(() => {
    setReorderOpen(false);
    setReorderSectionKey(null);
  }, []);

  // Form sheet state
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [subsectionFormOpen, setSubsectionFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<YearlyLineItem | null>(null);
  const [editingSubsection, setEditingSubsection] = useState<YearlySubsection | null>(null);
  const [targetSectionKey, setTargetSectionKey] = useState<YearlySectionKey>("income");
  const [targetSubsectionId, setTargetSubsectionId] = useState<Id<"yearlySubsections"> | undefined>(undefined);

  // Group data by section (with optimistic reordering support)
  const groupedData = useMemo(() => {
    if (!yearlyData) return null;

    const result: Record<YearlySectionKey, {
      sectionItems: YearlyLineItem[];
      subsections: YearlySubsection[];
      allItems: YearlyLineItem[];
    }> = {
      income: { sectionItems: [], subsections: [], allItems: [] },
      monthlyBills: { sectionItems: [], subsections: [], allItems: [] },
      nonMonthlyBills: { sectionItems: [], subsections: [], allItems: [] },
      debt: { sectionItems: [], subsections: [], allItems: [] },
      savings: { sectionItems: [], subsections: [], allItems: [] },
      investments: { sectionItems: [], subsections: [], allItems: [] },
    };

    // Group section items - use optimistic order if available
    for (const item of yearlyData.sectionItems) {
      const key = item.sectionKey as YearlySectionKey;
      result[key].sectionItems.push(item as YearlyLineItem);
      result[key].allItems.push(item as YearlyLineItem);
    }

    // Group subsections and their items
    for (const subsection of yearlyData.subsections) {
      const key = subsection.sectionKey as YearlySectionKey;
      result[key].subsections.push(subsection as YearlySubsection);
      for (const item of subsection.items) {
        result[key].allItems.push(item as YearlyLineItem);
      }
    }

    return result;
  }, [yearlyData]);

  // Compute all items for totals calculation
  const allItems = useMemo(() => {
    if (!groupedData) return [];
    return Object.values(groupedData).flatMap((section) => section.allItems);
  }, [groupedData]);

  // Compute totals and income breakdown
  const totals = useMemo(() => computeSectionTotals(allItems), [allItems]);
  const breakdown = useMemo(() => computeIncomeBreakdown(totals), [totals]);

  const selectedReorderSection = useMemo(() => {
    if (!groupedData || !reorderSectionKey) return null;
    return groupedData[reorderSectionKey];
  }, [groupedData, reorderSectionKey]);

  // Handlers for opening forms
  const handleAddItem = useCallback((sectionKey: YearlySectionKey, subsectionId?: Id<"yearlySubsections">) => {
    setEditingItem(null);
    setTargetSectionKey(sectionKey);
    setTargetSubsectionId(subsectionId);
    setItemFormOpen(true);
  }, []);

  const handleEditItem = useCallback((item: YearlyLineItem) => {
    setEditingItem(item);
    setTargetSectionKey(item.sectionKey);
    setTargetSubsectionId(item.subsectionId);
    setItemFormOpen(true);
  }, []);

  const handleDeleteItem = useCallback(async (item: YearlyLineItem) => {
    if (!user) return;
    const confirmed = window.confirm(`Delete "${item.label}"?`);
    if (!confirmed) return;
    try {
      setError(null);
      await removeLineItem({ token: user.token, lineItemId: item._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
    }
  }, [user, removeLineItem]);

  const handleAddSubsection = useCallback((sectionKey: YearlySubsectionSectionKey) => {
    setEditingSubsection(null);
    setTargetSectionKey(sectionKey);
    setSubsectionFormOpen(true);
  }, []);

  const handleEditSubsectionTitle = useCallback((subsection: YearlySubsection) => {
    setEditingSubsection(subsection);
    setTargetSectionKey(subsection.sectionKey);
    setSubsectionFormOpen(true);
  }, []);

  const handleDeleteSubsection = useCallback(async (subsection: YearlySubsection) => {
    if (!user) return;
    const confirmed = window.confirm(
      `Delete "${subsection.title}"? All items in this subsection will also be deleted.`
    );
    if (!confirmed) return;
    try {
      setError(null);
      await removeSubsection({ token: user.token, subsectionId: subsection._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete subsection");
    }
  }, [user, removeSubsection]);

  // Form submission handlers
  const handleItemSubmit = useCallback(async (values: LineItemFormValues) => {
    if (!user) return;

    if (editingItem) {
      // Update existing item
      await updateLineItem({
        token: user.token,
        lineItemId: editingItem._id,
        patch: values,
      });
    } else {
      // Create new item
      await createLineItem({
        token: user.token,
        year: selectedYear,
        sectionKey: targetSectionKey,
        subsectionId: targetSubsectionId,
        label: values.label,
        amountCents: values.amountCents,
        note: values.note,
        paymentSource: values.paymentSource,
        dueDate: values.dueDate,
        frequency: values.frequency,
        originalAmountCents: values.originalAmountCents,
        balanceCents: values.balanceCents,
        interestRate: values.interestRate,
        goalAmountCents: values.goalAmountCents,
        currentAmountCents: values.currentAmountCents,
        startMonth: values.startMonth,
        endMonth: values.endMonth,
        paymentDay: values.paymentDay,
      });
    }
  }, [user, editingItem, selectedYear, targetSectionKey, targetSubsectionId, createLineItem, updateLineItem]);

  const handleItemDelete = useCallback(async () => {
    if (!user || !editingItem) return;
    await removeLineItem({ token: user.token, lineItemId: editingItem._id });
  }, [user, editingItem, removeLineItem]);

  const handleSubsectionSubmit = useCallback(async (values: SubsectionFormValues) => {
    if (!user) return;

    if (editingSubsection) {
      // Update existing subsection
      await updateSubsection({
        token: user.token,
        subsectionId: editingSubsection._id,
        patch: { title: values.title },
      });
    } else {
      // Create new subsection
      await createSubsection({
        token: user.token,
        year: selectedYear,
        sectionKey: targetSectionKey as YearlySubsectionSectionKey,
        title: values.title,
      });
    }
  }, [user, editingSubsection, selectedYear, targetSectionKey, createSubsection, updateSubsection]);

  const handleSubsectionDelete = useCallback(async () => {
    if (!user || !editingSubsection) return;
    await removeSubsection({ token: user.token, subsectionId: editingSubsection._id });
  }, [user, editingSubsection, removeSubsection]);


  // Determine if current year is empty (no data)
  // Important: only return true when data has LOADED and is empty, not while loading
  const isCurrentYearEmpty = useMemo(() => {
    if (!yearlyData) return false; // Still loading - don't show copy button yet
    return yearlyData.sectionItems.length === 0 && yearlyData.subsections.length === 0;
  }, [yearlyData]);

  // Filter years available for copying (previous years with data, excluding current selection)
  const availableYearsToCopy = useMemo(() => {
    if (!yearsWithData) return [];
    return yearsWithData.filter((year) => year !== selectedYear);
  }, [yearsWithData, selectedYear]);

  // Show copy button only if current year is empty and there are years to copy from
  const showCopyButton = isCurrentYearEmpty && availableYearsToCopy.length > 0;

  // Handle copy from year
  const handleCopyFromYear = useCallback(async (sourceYear: number) => {
    if (!user) return;
    try {
      setError(null);
      await copyFromYear({
        token: user.token,
        sourceYear,
        targetYear: selectedYear,
      });
      setCopyModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy from year");
    }
  }, [user, copyFromYear, selectedYear]);

  // Navigation items
  const navItems = [
    { label: "Monthly Forecast", href: "/", active: false },
    { label: "Yearly Forecast", href: "/yearly", active: true },
  ];

  // Loading state
  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400 dark:text-zinc-500" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </main>
    );
  }

  // Auth required
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
        <div className="text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Please sign in to view your yearly forecast.
          </p>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col">
      {/* Fixed navbar */}
      <div className="shrink-0 sticky top-0 z-40">
        <Navbar items={navItems} onSignOut={signOut} />
      </div>

      {/* Spreadsheet container with pan/zoom */}
      <SpreadsheetContainer className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 pb-48 space-y-6">
          {/* Error banner */}
          {error && (
            <div className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3",
              "border-rose-200 bg-rose-50 text-rose-700",
              "dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
            )}>
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Year selector and copy button */}
          <div className="flex items-center justify-start gap-4 flex-wrap">
            <YearSelector year={selectedYear} onChange={setSelectedYear} />
            {showCopyButton && (
              <Button
                variant="outline"
                onClick={() => setCopyModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy from Another Year
              </Button>
            )}
          </div>

          {/* Loading state for data */}
          {!yearlyData && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400 dark:text-zinc-500" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading yearly data...</p>
            </div>
          )}

          {/* Income Summary section */}
          {groupedData && (
            <YearlyIncomeSummary
              incomeItems={groupedData.income.sectionItems}
              totals={totals}
              breakdown={breakdown}
              onAddItem={() => handleAddItem("income")}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onReorder={() => openReorderSheet("income")}
            />
          )}

          {/* Other sections */}
          {groupedData && YEARLY_SUBSECTION_SECTION_DEFS.map((section) => (
            <YearlySectionTable
              key={section.key}
              sectionKey={section.key}
              sectionItems={groupedData[section.key].sectionItems}
              subsections={groupedData[section.key].subsections}
              totalIncomeMonthly={totals.incomeMonthly}
              sectionTotals={totals}
              allItems={groupedData[section.key].allItems}
              onAddSectionItem={() => handleAddItem(section.key)}
              onAddSubsection={() => handleAddSubsection(section.key)}
              onEditSubsectionTitle={handleEditSubsectionTitle}
              onDeleteSubsection={handleDeleteSubsection}
              onAddSubsectionItem={(subsection) => handleAddItem(section.key, subsection._id)}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              onReorder={() => openReorderSheet(section.key)}
            />
          ))}
        </div>
      </SpreadsheetContainer>

      {reorderSectionKey && selectedReorderSection && (
        <YearlyReorderSheet
          open={reorderOpen}
          onOpenChange={(open) => (open ? setReorderOpen(true) : closeReorderSheet())}
          sectionKey={reorderSectionKey}
          year={selectedYear}
          token={user.token}
          sectionItems={selectedReorderSection.sectionItems}
          subsections={selectedReorderSection.subsections}
          reorderSubsections={reorderSubsections}
          reorderLineItems={reorderLineItems}
          moveLineItem={moveLineItem}
        />
      )}

      {/* Form sheets */}
      <YearlyItemFormSheet
        open={itemFormOpen}
        onOpenChange={setItemFormOpen}
        onSubmit={handleItemSubmit}
        onDelete={editingItem ? handleItemDelete : undefined}
        item={editingItem}
        sectionKey={targetSectionKey}
        sectionTotals={totals}
      />

      <YearlySubsectionFormSheet
        open={subsectionFormOpen}
        onOpenChange={setSubsectionFormOpen}
        onSubmit={handleSubsectionSubmit}
        onDelete={editingSubsection ? handleSubsectionDelete : undefined}
        subsection={editingSubsection}
      />

      {/* Copy from year modal */}
      <CopyFromYearModal
        open={copyModalOpen}
        onOpenChange={setCopyModalOpen}
        availableYears={availableYearsToCopy}
        onCopy={handleCopyFromYear}
      />
    </main>
  );
}

// ============================================================================
// Copy From Year Modal
// ============================================================================

function CopyFromYearModal({
  open,
  onOpenChange,
  availableYears,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableYears: number[];
  onCopy: (sourceYear: number) => Promise<void>;
}) {
  const [selectedYear, setSelectedYear] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset modal state when it opens
  useEffect(() => {
    if (open) {
      setSelectedYear("");
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (selectedYear === "") return;
    setIsSubmitting(true);
    try {
      await onCopy(selectedYear);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Copy from Previous Year
        </h2>
        
        <div className="space-y-4">
          {/* Year selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Select year to copy from
            </label>
            <select
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base sm:text-sm text-zinc-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 scheme-light dark:scheme-dark"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select a year...</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            This will copy all income, bills, debt, savings, and investment items from the selected year to the current year.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedYear === "" || isSubmitting}
          >
            {isSubmitting ? "Copying..." : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}

