"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  closestCenter,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { arrayMove } from "@dnd-kit/sortable";
import { Loader2, AlertCircle } from "lucide-react";
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
import { YearlyLineItemRowOverlay } from "@/components/yearly/yearly-line-item-row";
import { YearlySubsectionOverlay } from "@/components/yearly/yearly-subsection";
import { computeSectionTotals, computeIncomeBreakdown } from "@/lib/yearly-calculations";
import type { YearlyLineItem, YearlySubsection, YearlySectionKey, YearlySubsectionSectionKey, LineItemFormValues, SubsectionFormValues } from "@/components/yearly/types";
import { YEARLY_SUBSECTION_SECTION_DEFS } from "@/lib/yearly-constants";
import { cn } from "@/lib/utils";

// Drag types for identifying what's being dragged
type DragData = 
  | { type: "incomeLineItem"; sectionKey: "income"; item: YearlyLineItem }
  | { type: "lineItem"; sectionKey: YearlySectionKey; subsectionId: Id<"yearlySubsections"> | undefined; item: YearlyLineItem }
  | { type: "subsection"; sectionKey: YearlySubsectionSectionKey; subsection: YearlySubsection };

export default function YearlyPage() {
  const { user, isLoading: isAuthLoading, signOut } = useAuth();

  // Year state (default to current year)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Data fetching
  const yearlyData = useQuery(
    api.yearly.listForYear,
    user ? { token: user.token, year: selectedYear } : "skip"
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

  // DnD state
  const [activeData, setActiveData] = useState<DragData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Configure sensors to match monthly forecast feel
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Optimistic state for drag reordering (prevents shuffle effect)
  // Structure: { [containerId]: YearlyLineItem[] | YearlySubsection[] }
  const [optimisticItems, setOptimisticItems] = useState<Record<string, YearlyLineItem[]> | null>(null);
  const [optimisticSubsections, setOptimisticSubsections] = useState<Record<string, YearlySubsection[]> | null>(null);
  
  // Track the last known yearlyData to detect server updates
  const lastYearlyDataRef = useRef(yearlyData);
  
  // Clear optimistic state when server data changes
   
  useEffect(() => {
    if (yearlyData !== lastYearlyDataRef.current) {
      lastYearlyDataRef.current = yearlyData;
      setOptimisticItems(null);
      setOptimisticSubsections(null);
    }
  }, [yearlyData]);

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

    // Apply optimistic item reordering
    if (optimisticItems) {
      for (const [containerId, items] of Object.entries(optimisticItems)) {
        if (containerId === "income-section") {
          result.income.sectionItems = items;
        } else if (containerId.startsWith("section-")) {
          const sectionKey = containerId.replace("section-", "") as YearlySectionKey;
          if (result[sectionKey]) {
            result[sectionKey].sectionItems = items;
          }
        } else {
          // It's a subsection ID - find and update the subsection's items
          for (const sectionKey of Object.keys(result) as YearlySectionKey[]) {
            const subsectionIndex = result[sectionKey].subsections.findIndex(s => s._id === containerId);
            if (subsectionIndex !== -1) {
              result[sectionKey].subsections[subsectionIndex] = {
                ...result[sectionKey].subsections[subsectionIndex],
                items,
              };
              break;
            }
          }
        }
      }
    }

    // Apply optimistic subsection reordering
    if (optimisticSubsections) {
      for (const [sectionKey, subsections] of Object.entries(optimisticSubsections)) {
        const key = sectionKey as YearlySectionKey;
        if (result[key]) {
          result[key].subsections = subsections;
        }
      }
    }

    return result;
  }, [yearlyData, optimisticItems, optimisticSubsections]);

  // Compute all items for totals calculation
  const allItems = useMemo(() => {
    if (!groupedData) return [];
    return Object.values(groupedData).flatMap((section) => section.allItems);
  }, [groupedData]);

  // Compute totals and income breakdown
  const totals = useMemo(() => computeSectionTotals(allItems), [allItems]);
  const breakdown = useMemo(() => computeIncomeBreakdown(totals), [totals]);

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

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) {
      setActiveData(data);
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveData(null);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveData(null);
    
    if (!user || !groupedData) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeDataTyped = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | { type: "droppableContainer"; containerId: string } | undefined;
    if (!activeDataTyped || !overData) return;

    // Handle income item reordering
    if (activeDataTyped.type === "incomeLineItem") {
      if (overData.type === "incomeLineItem") {
        const items = groupedData.income.sectionItems;
        const oldIndex = items.findIndex(i => i._id === active.id);
        const newIndex = items.findIndex(i => i._id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(items, oldIndex, newIndex);
          
          // Optimistically update UI immediately
          setOptimisticItems(prev => ({
            ...prev,
            "income-section": reordered,
          }));
          
          try {
            await reorderLineItems({
              token: user.token,
              year: selectedYear,
              sectionKey: "income",
              orderedIds: reordered.map(i => i._id),
            });
          } catch (err) {
            // Revert on error
            setOptimisticItems(null);
            setError(err instanceof Error ? err.message : "Failed to reorder items");
          }
        }
      }
      return;
    }

    // Handle subsection reordering
    if (activeDataTyped.type === "subsection") {
      if (overData.type === "subsection" && activeDataTyped.sectionKey === overData.sectionKey) {
        const subsections = groupedData[activeDataTyped.sectionKey].subsections;
        const oldIndex = subsections.findIndex(s => s._id === active.id);
        const newIndex = subsections.findIndex(s => s._id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(subsections, oldIndex, newIndex);
          
          // Optimistically update UI immediately
          setOptimisticSubsections(prev => ({
            ...prev,
            [activeDataTyped.sectionKey]: reordered,
          }));
          
          try {
            await reorderSubsections({
              token: user.token,
              year: selectedYear,
              sectionKey: activeDataTyped.sectionKey,
              orderedIds: reordered.map(s => s._id),
            });
          } catch (err) {
            // Revert on error
            setOptimisticSubsections(null);
            setError(err instanceof Error ? err.message : "Failed to reorder subsections");
          }
        }
      }
      return;
    }

    // Handle line item reordering and cross-container moves
    if (activeDataTyped.type === "lineItem") {
      const activeSectionKey = activeDataTyped.sectionKey;
      const activeSubsectionId = activeDataTyped.subsectionId;

      // Determine target container
      let targetSubsectionId: Id<"yearlySubsections"> | undefined;
      let targetSectionKey: YearlySectionKey;

      if (overData.type === "lineItem") {
        targetSubsectionId = overData.subsectionId;
        targetSectionKey = overData.sectionKey;
      } else if (overData.type === "droppableContainer") {
        // Dropped on a container (subsection or section-level area)
        const containerId = overData.containerId;
        if (containerId.startsWith("section-")) {
          targetSectionKey = containerId.replace("section-", "") as YearlySectionKey;
          targetSubsectionId = undefined;
        } else {
          // Subsection container
          targetSubsectionId = containerId as Id<"yearlySubsections">;
          const subsection = groupedData[activeSectionKey].subsections.find(s => s._id === containerId);
          targetSectionKey = subsection?.sectionKey ?? activeSectionKey;
        }
      } else {
        return;
      }

      // Prevent cross-section moves
      if (activeSectionKey !== targetSectionKey) return;

      // Same container - reorder
      if (activeSubsectionId === targetSubsectionId) {
        const items = activeSubsectionId === undefined
          ? groupedData[activeSectionKey].sectionItems
          : groupedData[activeSectionKey].subsections.find(s => s._id === activeSubsectionId)?.items ?? [];
        
        const oldIndex = items.findIndex(i => i._id === active.id);
        const newIndex = items.findIndex(i => i._id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(items, oldIndex, newIndex);
          
          // Build container ID for optimistic state
          const containerId = activeSubsectionId ?? `section-${activeSectionKey}`;
          
          // Optimistically update UI immediately
          setOptimisticItems(prev => ({
            ...prev,
            [containerId]: reordered,
          }));
          
          try {
            await reorderLineItems({
              token: user.token,
              year: selectedYear,
              sectionKey: activeSectionKey,
              subsectionId: activeSubsectionId,
              orderedIds: reordered.map(i => i._id),
            });
          } catch (err) {
            // Revert on error
            setOptimisticItems(null);
            setError(err instanceof Error ? err.message : "Failed to reorder items");
          }
        }
      } else {
        // Cross-container move
        const sourceItems = activeSubsectionId === undefined
          ? groupedData[activeSectionKey].sectionItems
          : groupedData[activeSectionKey].subsections.find(s => s._id === activeSubsectionId)?.items ?? [];
        
        const destItems = targetSubsectionId === undefined
          ? groupedData[activeSectionKey].sectionItems
          : groupedData[activeSectionKey].subsections.find(s => s._id === targetSubsectionId)?.items ?? [];

        // Build source ordered IDs (excluding moved item)
        const newSourceItems = sourceItems.filter(i => i._id !== active.id);
        const sourceOrderedIds = newSourceItems.map(i => i._id);

        // Build dest ordered IDs (including moved item at new position)
        const targetIndex = overData.type === "lineItem" 
          ? destItems.findIndex(i => i._id === over.id)
          : destItems.length; // Dropped on container, add at end
        
        const newDestItems = [...destItems.filter(i => i._id !== active.id)];
        newDestItems.splice(targetIndex >= 0 ? targetIndex : newDestItems.length, 0, activeDataTyped.item);
        const destOrderedIds = newDestItems.map(i => i._id);

        // Build container IDs for optimistic state
        const sourceContainerId = activeSubsectionId ?? `section-${activeSectionKey}`;
        const destContainerId = targetSubsectionId ?? `section-${activeSectionKey}`;

        // Optimistically update UI immediately
        setOptimisticItems(prev => ({
          ...prev,
          [sourceContainerId]: newSourceItems,
          [destContainerId]: newDestItems,
        }));

        try {
          await moveLineItem({
            token: user.token,
            lineItemId: active.id as Id<"yearlyLineItems">,
            toSubsectionId: targetSubsectionId,
            sourceOrderedIds,
            destOrderedIds,
          });
        } catch (err) {
          // Revert on error
          setOptimisticItems(null);
          setError(err instanceof Error ? err.message : "Failed to move item");
        }
      }
    }
  }, [user, groupedData, selectedYear, reorderLineItems, reorderSubsections, moveLineItem]);

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
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

            {/* Year selector */}
            <div className="flex items-center justify-start">
              <YearSelector year={selectedYear} onChange={setSelectedYear} />
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
                allItems={groupedData[section.key].allItems}
                onAddSectionItem={() => handleAddItem(section.key)}
                onAddSubsection={() => handleAddSubsection(section.key)}
                onEditSubsectionTitle={handleEditSubsectionTitle}
                onDeleteSubsection={handleDeleteSubsection}
                onAddSubsectionItem={(subsection) => handleAddItem(section.key, subsection._id)}
                onEditItem={handleEditItem}
                onDeleteItem={handleDeleteItem}
              />
            ))}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeData?.type === "incomeLineItem" && (
              <YearlyLineItemRowOverlay
                item={activeData.item}
                sectionKey="income"
                totalIncomeMonthly={totals.incomeMonthly}
              />
            )}
            {activeData?.type === "lineItem" && (
              <YearlyLineItemRowOverlay
                item={activeData.item}
                sectionKey={activeData.sectionKey}
                totalIncomeMonthly={totals.incomeMonthly}
              />
            )}
            {activeData?.type === "subsection" && (
              <YearlySubsectionOverlay subsection={activeData.subsection} />
            )}
          </DragOverlay>
        </DndContext>
      </SpreadsheetContainer>

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
    </main>
  );
}

