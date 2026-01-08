"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  type UniqueIdentifier,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/yearly-calculations";
import type {
  YearlyLineItem,
  YearlySectionKey,
  YearlySubsection,
  YearlySubsectionSectionKey,
} from "./types";
import { sectionTitles } from "./column-definitions";

const SECTION_CONTAINER_ID = "container:section";

type ReorderSubsectionsFn = (args: {
  token: string;
  year: number;
  sectionKey: YearlySubsectionSectionKey;
  orderedIds: Id<"yearlySubsections">[];
}) => Promise<unknown>;

type ReorderLineItemsFn = (args: {
  token: string;
  year: number;
  sectionKey: YearlySectionKey;
  subsectionId?: Id<"yearlySubsections">;
  orderedIds: Id<"yearlyLineItems">[];
}) => Promise<unknown>;

type MoveLineItemFn = (args: {
  token: string;
  lineItemId: Id<"yearlyLineItems">;
  toSubsectionId?: Id<"yearlySubsections">;
  sourceOrderedIds: Id<"yearlyLineItems">[];
  destOrderedIds: Id<"yearlyLineItems">[];
}) => Promise<unknown>;

type YearlyReorderSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionKey: YearlySectionKey | null;
  year: number;
  token: string | null;
  sectionItems: YearlyLineItem[];
  subsections: YearlySubsection[];
  reorderSubsections: ReorderSubsectionsFn;
  reorderLineItems: ReorderLineItemsFn;
  moveLineItem: MoveLineItemFn;
};

type DragData =
  | { type: "subsection"; subsectionId: Id<"yearlySubsections"> }
  | { type: "item"; subsectionId?: Id<"yearlySubsections">; item: YearlyLineItem };

type OverData =
  | { type: "subsection"; subsectionId: Id<"yearlySubsections"> }
  | { type: "item"; subsectionId?: Id<"yearlySubsections">; itemId: Id<"yearlyLineItems"> }
  | { type: "container"; containerId: string; subsectionId?: Id<"yearlySubsections"> };

export function YearlyReorderSheet({
  open,
  onOpenChange,
  sectionKey,
  year,
  token,
  sectionItems,
  subsections,
  reorderSubsections,
  reorderLineItems,
  moveLineItem,
}: YearlyReorderSheetProps) {
  const effectiveOpen = open && Boolean(sectionKey);

  const [orderedSubsections, setOrderedSubsections] = useState<YearlySubsection[]>(() =>
    subsections.map((sub) => ({ ...sub })),
  );
  const [itemsByContainer, setItemsByContainer] = useState<Record<string, YearlyLineItem[]>>(() =>
    buildItemsMap(sectionItems, subsections),
  );
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const title = sectionKey ? sectionTitles[sectionKey] : "Reorder";

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) {
      setActiveDrag(data);
    }
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null);
    if (!token || !sectionKey) return;

    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as OverData | undefined;
    if (!activeData || !overData) return;

    // Subsection reorder (skip for income)
    if (activeData.type === "subsection") {
      if (sectionKey === "income") return;
      if (overData.type !== "subsection") return;

      const prev = orderedSubsections;
      const oldIndex = prev.findIndex((s) => s._id === activeData.subsectionId);
      const newIndex = prev.findIndex((s) => s._id === overData.subsectionId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(prev, oldIndex, newIndex);
      setOrderedSubsections(reordered);

      try {
        await reorderSubsections({
          token,
          year,
          sectionKey,
          orderedIds: reordered.map((s) => s._id),
        });
      } catch (err) {
        setOrderedSubsections(prev);
        setError(getErrorMessage(err, "Failed to reorder subsections"));
      }
      return;
    }

    // Item reorder / move
    if (activeData.type === "item") {
      const sourceContainerId = getContainerId(activeData.subsectionId);
      const sourceItems = itemsByContainer[sourceContainerId] ?? [];
      const activeItem = activeData.item;

      let targetContainerId: string | null = null;
      let targetSubsectionId: Id<"yearlySubsections"> | undefined;
      let targetIndex: number | null = null;

      if (overData.type === "item") {
        targetContainerId = getContainerId(overData.subsectionId);
        targetSubsectionId = overData.subsectionId;
        const destItems = itemsByContainer[targetContainerId] ?? [];
        targetIndex = destItems.findIndex((item) => item._id === overData.itemId);
      } else if (overData.type === "container") {
        targetContainerId = overData.containerId;
        targetSubsectionId = overData.subsectionId;
        targetIndex = (itemsByContainer[targetContainerId] ?? []).length;
      }

      if (!targetContainerId) return;

      // Reorder within same container
      if (sourceContainerId === targetContainerId) {
        const oldIndex = sourceItems.findIndex((item) => item._id === activeItem._id);
        if (oldIndex === -1 || targetIndex === null || oldIndex === targetIndex) return;

        const reordered = arrayMove(sourceItems, oldIndex, targetIndex);
        setItemsByContainer((prev) => ({
          ...prev,
          [sourceContainerId]: reordered,
        }));

        try {
          await reorderLineItems({
            token,
            year,
            sectionKey,
            subsectionId: activeData.subsectionId,
            orderedIds: reordered.map((item) => item._id),
          });
        } catch (err) {
          setItemsByContainer((prev) => ({ ...prev, [sourceContainerId]: sourceItems }));
          setError(getErrorMessage(err, "Failed to reorder items"));
        }
        return;
      }

      // Move between containers within the same section
      const destItems = itemsByContainer[targetContainerId] ?? [];
      const sourceWithoutActive = sourceItems.filter((item) => item._id !== activeItem._id);
      const destWithoutActive = destItems.filter((item) => item._id !== activeItem._id);

      const insertionIndex =
        targetIndex !== null && targetIndex >= 0 ? targetIndex : destWithoutActive.length;

      const nextDestItems = [...destWithoutActive];
      nextDestItems.splice(insertionIndex, 0, activeItem);

      setItemsByContainer((prev) => ({
        ...prev,
        [sourceContainerId]: sourceWithoutActive,
        [targetContainerId]: nextDestItems,
      }));

      try {
        await moveLineItem({
          token,
          lineItemId: activeItem._id,
          toSubsectionId: targetSubsectionId,
          sourceOrderedIds: sourceWithoutActive.map((item) => item._id),
          destOrderedIds: nextDestItems.map((item) => item._id),
        });
      } catch (err) {
        // Reset to server state on failure
        setItemsByContainer(buildItemsMap(sectionItems, subsections));
        setError(getErrorMessage(err, "Failed to move item"));
      }
    }
  };

  if (!effectiveOpen) {
    return null;
  }

  return (
    <Sheet open={effectiveOpen} onOpenChange={onOpenChange}>
      <SheetContent position="right" className="p-0" title={`Reorder: ${title}`} hideHeader>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex h-full flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Reorder
                </p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {error && (
                  <span className="text-xs text-rose-600 dark:text-rose-300">
                    {error}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
              {sectionKey !== "income" && (
                <SortableContext
                  items={orderedSubsections.map((sub) => getSubsectionId(sub._id))}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {orderedSubsections.length === 0 && (
                      <EmptyPill label="No subsections yet" />
                    )}
                    {orderedSubsections.map((sub) => (
                      <SortableSubsectionCard
                        key={sub._id}
                        subsection={sub}
                        itemCount={(itemsByContainer[getSubsectionContainerId(sub._id)] ?? []).length}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}

              <div className="space-y-3">
                <ReorderContainer
                  title={sectionKey === "income" ? "Income sources" : "No subsection"}
                  subtitle={sectionKey === "income" ? "Reorder your income sources" : "Items at the section level"}
                  containerId={SECTION_CONTAINER_ID}
                >
                  <SortableContext
                    items={(itemsByContainer[SECTION_CONTAINER_ID] ?? []).map((item) =>
                      getItemId(item._id),
                    )}
                    strategy={verticalListSortingStrategy}
                  >
                    <ItemList
                      subsectionId={undefined}
                      items={itemsByContainer[SECTION_CONTAINER_ID] ?? []}
                    />
                  </SortableContext>
                </ReorderContainer>

                {sectionKey !== "income" &&
                  orderedSubsections.map((sub) => {
                    const containerId = getSubsectionContainerId(sub._id);
                    return (
                      <ReorderContainer
                        key={sub._id}
                        title={sub.title}
                        subtitle="Drag items here to move into this subsection"
                        containerId={containerId}
                        subsectionId={sub._id}
                      >
                        <SortableContext
                          items={(itemsByContainer[containerId] ?? []).map((item) =>
                            getItemId(item._id),
                          )}
                          strategy={verticalListSortingStrategy}
                        >
                          <ItemList
                            subsectionId={sub._id}
                            items={itemsByContainer[containerId] ?? []}
                          />
                        </SortableContext>
                      </ReorderContainer>
                    );
                  })}
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeDrag?.type === "subsection" && (
              <Pill label="Subsection" value={getSubsectionTitle(activeDrag.subsectionId, orderedSubsections)} />
            )}
            {activeDrag?.type === "item" && (
              <ItemPill item={activeDrag.item} />
            )}
          </DragOverlay>
        </DndContext>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ReorderContainer({
  title,
  subtitle,
  containerId,
  subsectionId,
  children,
}: {
  title: string;
  subtitle: string;
  containerId: string;
  subsectionId?: Id<"yearlySubsections">;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppableContainer(containerId, subsectionId);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border border-dashed border-zinc-200 bg-white p-3 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900",
        isOver && "border-blue-400 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-900/20",
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function ItemList({
  items,
  subsectionId,
}: {
  items: YearlyLineItem[];
  subsectionId?: Id<"yearlySubsections">;
}) {
  if (items.length === 0) {
    return <EmptyPill label="Drag items here" />;
  }

  return (
    <>
      {items.map((item) => (
        <SortableItemCard key={item._id} item={item} subsectionId={subsectionId} />
      ))}
    </>
  );
}

function SortableItemCard({
  item,
  subsectionId,
}: {
  item: YearlyLineItem;
  subsectionId?: Id<"yearlySubsections">;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: getItemId(item._id),
    data: { type: "item", itemId: item._id, subsectionId, item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-800/70",
        isDragging && "border-blue-400 bg-blue-50 shadow-lg dark:border-blue-500 dark:bg-blue-900/40",
      )}
    >
      <button
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-medium text-sm text-zinc-900 dark:text-zinc-50">
          {item.label}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatCurrency(item.amountCents)} / mo
        </p>
      </div>
    </div>
  );
}

function SortableSubsectionCard({
  subsection,
  itemCount,
}: {
  subsection: YearlySubsection;
  itemCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: getSubsectionId(subsection._id),
    data: { type: "subsection", subsectionId: subsection._id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-800/70",
        isDragging && "border-blue-400 bg-blue-50 shadow-lg dark:border-blue-500 dark:bg-blue-900/40",
      )}
    >
      <button
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        {...attributes}
        {...listeners}
        aria-label="Drag subsection"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-semibold text-sm text-zinc-900 dark:text-zinc-50">
          {subsection.title}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {itemCount} item{subsectionPlural(itemCount)}
        </p>
      </div>
    </div>
  );
}

function EmptyPill({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <X className="h-3 w-3" />
      {label}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 shadow-lg dark:border-blue-500 dark:bg-zinc-900 dark:text-blue-200">
      <div className="text-[11px] uppercase tracking-wide text-blue-500 dark:text-blue-300">
        {label}
      </div>
      <div className="truncate">{value}</div>
    </div>
  );
}

function ItemPill({ item }: { item: YearlyLineItem }) {
  return (
    <div className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 shadow-lg dark:border-blue-500 dark:bg-zinc-900 dark:text-blue-200">
      <div className="truncate">{item.label}</div>
      <div className="text-xs text-blue-500 dark:text-blue-300">{formatCurrency(item.amountCents)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getContainerId(subsectionId?: Id<"yearlySubsections">) {
  return subsectionId ? getSubsectionContainerId(subsectionId) : SECTION_CONTAINER_ID;
}

function getSubsectionContainerId(subsectionId: Id<"yearlySubsections">) {
  return `container:subsection:${subsectionId}`;
}

function buildItemsMap(sourceSectionItems: YearlyLineItem[], sourceSubsections: YearlySubsection[]) {
  const map: Record<string, YearlyLineItem[]> = {
    [SECTION_CONTAINER_ID]: sourceSectionItems.map((item) => ({ ...item })),
  };

  for (const sub of sourceSubsections) {
    map[getSubsectionContainerId(sub._id)] = sub.items.map((item) => ({ ...item }));
  }

  return map;
}

function getSubsectionId(subsectionId: Id<"yearlySubsections">): UniqueIdentifier {
  return `subsection:${subsectionId}`;
}

function getItemId(itemId: Id<"yearlyLineItems">): UniqueIdentifier {
  return `item:${itemId}`;
}

function getSubsectionTitle(
  subsectionId: Id<"yearlySubsections">,
  subsections: YearlySubsection[],
) {
  return subsections.find((sub) => sub._id === subsectionId)?.title ?? "Subsection";
}

function subsectionPlural(count: number) {
  return count === 1 ? "" : "s";
}

function useDroppableContainer(containerId: string, subsectionId?: Id<"yearlySubsections">) {
  const { setNodeRef, isOver } = useDroppable({
    id: containerId,
    data: { type: "container", containerId, subsectionId },
  });

  return { setNodeRef, isOver };
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}
