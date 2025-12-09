"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { calculateBalances, formatCurrency, toCents } from "@/lib/balances";
import { useAuth } from "@/components/auth/auth-context";
import { useTheme } from "@/components/theme/theme-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Sun,
  Trash2,
  X,
} from "lucide-react";

type Month = {
  _id: Id<"months">;
  name: string;
  year: number;
  monthIndex: number;
  startingBalanceCents: number;
  currency: string;
};

type Transaction = {
  _id: Id<"transactions">;
  monthId: Id<"months">;
  userId: Id<"users">;
  label: string;
  type: "income" | "bill" | "saving";
  amountCents: number;
  date: string;
  isPaid: boolean;
  order: number;
  category?: string;
  isRecurring: boolean;
  isTemplateOnly: boolean;
  mode: "fixed" | "percentage";
  savingsPercentage?: number;
  linkedIncomeId?: Id<"transactions">;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function monthLabel(year: number, monthIndex: number) {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

export default function Home() {
  const { user, isLoading: isAuthLoading, signIn, signUp, signOut } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Start with current month
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(now.getMonth());

  const months = useQuery(api.months.list, user ? { token: user.token } : "skip") as
    | Month[]
    | undefined;

  // Find existing month for current selection, or null if it doesn't exist yet
  const currentMonth = useMemo(() => {
    if (!months) return null;
    return months.find(
      (m) => m.year === selectedYear && m.monthIndex === selectedMonthIndex
    ) ?? null;
  }, [months, selectedYear, selectedMonthIndex]);

  const transactions = useQuery(
    api.transactions.listForMonth,
    user && currentMonth
      ? { token: user.token, monthId: currentMonth._id }
      : "skip",
  ) as Transaction[] | undefined;

  const createMonth = useMutation(api.months.create);
  const updateMonthMeta = useMutation(api.months.updateMeta);
  const createTx = useMutation(api.transactions.create);
  const updateTx = useMutation(api.transactions.update);
  const deleteTx = useMutation(api.transactions.remove);
  const reorderTx = useMutation(api.transactions.reorder);
  const togglePaid = useMutation(api.transactions.togglePaid);

  const balances = useMemo(() => {
    if (!transactions || !currentMonth) {
      return {
        currentBankBalanceCents: currentMonth?.startingBalanceCents ?? 0,
        projectedBalances: {} as Record<string, number>,
        projectedEndBalanceCents: currentMonth?.startingBalanceCents ?? 0,
      };
    }
    return calculateBalances(transactions, currentMonth.startingBalanceCents);
  }, [transactions, currentMonth]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [localTransactions, setLocalTransactions] = useState<Transaction[] | null>(null);
  
  // Sync local transactions with server data
  useEffect(() => {
    if (transactions) {
      setLocalTransactions(transactions);
    }
  }, [transactions]);

  const displayTransactions = localTransactions ?? transactions;
  const activeTransaction = displayTransactions?.find((t) => t._id === activeId);

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!displayTransactions || !user || !currentMonth || !over || active.id === over.id) return;

    const oldIndex = displayTransactions.findIndex((t) => t._id === active.id);
    const newIndex = displayTransactions.findIndex((t) => t._id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Optimistically update local state immediately
    const reordered = arrayMove(displayTransactions, oldIndex, newIndex);
    setLocalTransactions(reordered);
    
    const orderedIds = reordered.map((t) => t._id);
    await reorderTx({ token: user.token, monthId: currentMonth._id, orderedIds });
  };

  const onDragCancel = () => {
    setActiveId(null);
  };

  // Create month on-demand when needed
  const ensureMonthExists = async (): Promise<Id<"months"> | null> => {
    if (!user) return null;
    if (currentMonth) return currentMonth._id;

    const name = monthLabel(selectedYear, selectedMonthIndex);
    const newId = await createMonth({
      token: user.token,
      name,
      year: selectedYear,
      monthIndex: selectedMonthIndex,
      startingBalanceCents: 0,
      currency: "USD",
    });
    return newId;
  };

  const handleSaveTx = async (input: TransactionFormValues) => {
    if (!user) return;
    
    // Ensure month exists before adding transaction
    const monthId = await ensureMonthExists();
    if (!monthId) return;

    if (editing) {
      await updateTx({
        token: user.token,
        transactionId: editing._id,
        patch: {
          label: input.label,
          type: input.type,
          amountCents: input.amountCents,
          date: input.date,
          order: input.order,
          category: input.category || undefined,
          isRecurring: input.isRecurring,
          isTemplateOnly: input.isTemplateOnly,
          mode: input.mode,
          savingsPercentage: input.savingsPercentage,
          linkedIncomeId: input.linkedIncomeId as Id<"transactions"> | undefined,
        },
      });
    } else {
      await createTx({
        token: user.token,
        monthId,
        label: input.label,
        type: input.type,
        amountCents: input.amountCents,
        date: input.date,
        order: input.order,
        category: input.category || undefined,
        isRecurring: input.isRecurring,
        isTemplateOnly: input.isTemplateOnly,
        mode: input.mode,
        savingsPercentage: input.savingsPercentage,
        linkedIncomeId: input.linkedIncomeId as Id<"transactions"> | undefined,
      });
    }

    setEditing(null);
    setAddOpen(false);
  };

  const handleDeleteTx = async (id: Id<"transactions">) => {
    if (!user) return;
    await deleteTx({ token: user.token, transactionId: id });
    setEditing(null);
    setAddOpen(false);
  };

  const handleUpdateStartingBalance = async (newBalanceCents: number) => {
    if (!user) return;
    
    // Ensure month exists
    let monthId = currentMonth?._id;
    if (!monthId) {
      monthId = await ensureMonthExists() ?? undefined;
    }
    if (!monthId) return;

    await updateMonthMeta({
      token: user.token,
      monthId,
      startingBalanceCents: newBalanceCents,
    });
  };

  const handlePrevMonth = () => {
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonthIndex(selectedMonthIndex - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex === 11) {
      setSelectedMonthIndex(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonthIndex(selectedMonthIndex + 1);
    }
  };

  const handleSelectMonth = (year: number, monthIndex: number) => {
    setSelectedYear(year);
    setSelectedMonthIndex(monthIndex);
  };

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  const monthExists = currentMonth !== null;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20 text-zinc-900 dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <Header
          year={selectedYear}
          monthIndex={selectedMonthIndex}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onSelectMonth={handleSelectMonth}
          onSignOut={signOut}
        />

        <>
          <BalanceCard
            startingBalance={currentMonth?.startingBalanceCents ?? 0}
            current={balances.currentBankBalanceCents}
            projected={balances.projectedEndBalanceCents}
            currency={currentMonth?.currency ?? "USD"}
            onUpdateStartingBalance={handleUpdateStartingBalance}
          />

          <div className="flex gap-2">
            <Button
              onClick={() => {
                setEditing(null);
                setAddOpen(true);
              }}
              className="flex-1"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add item
            </Button>
          </div>

          <Card className="border-none bg-transparent shadow-none">
            <CardContent className="p-0">
              <ScrollArea className="max-h-[70vh]">
                {monthExists && displayTransactions ? (
                  <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragCancel={onDragCancel}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  >
                    <SortableContext
                      items={displayTransactions.map((t) => t._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {displayTransactions.map((tx) => (
                          <TransactionRow
                            key={tx._id}
                            transaction={tx}
                            projectedBalance={balances.projectedBalances[tx._id]}
                            currency={currentMonth?.currency ?? "USD"}
                            isDragging={activeId === tx._id}
                            onEdit={() => {
                              setEditing(tx);
                              setAddOpen(true);
                            }}
                            onDelete={() => handleDeleteTx(tx._id)}
                            onTogglePaid={(value) =>
                              togglePaid({
                                token: user.token,
                                transactionId: tx._id,
                                isPaid: value,
                              })
                            }
                          />
                        ))}
                        {displayTransactions.length === 0 && (
                          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                            No transactions yet. Add your first item to start forecasting.
                          </div>
                        )}
                      </div>
                    </SortableContext>
                    <DragOverlay>
                      {activeTransaction ? (
                        <TransactionRowOverlay
                          transaction={activeTransaction}
                          projectedBalance={balances.projectedBalances[activeTransaction._id]}
                          currency={currentMonth?.currency ?? "USD"}
                        />
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                    <CalendarPlus className="mx-auto mb-2 h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">
                      {monthLabel(selectedYear, selectedMonthIndex)}
                    </p>
                    <p className="mt-1">
                      No data for this month yet. Add items or update the starting balance to begin.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      </div>

      <TransactionFormSheet
        key={editing?._id ?? `new-${addOpen}`}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleSaveTx}
        onDelete={editing ? () => handleDeleteTx(editing._id) : undefined}
        transaction={editing}
        incomes={(transactions ?? []).filter((t) => t.type === "income")}
        nextOrder={(transactions ?? []).length}
      />
    </main>
  );
}

function Header({
  year,
  monthIndex,
  onPrevMonth,
  onNextMonth,
  onSelectMonth,
  onSignOut,
}: {
  year: number;
  monthIndex: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectMonth: (year: number, monthIndex: number) => void;
  onSignOut: () => Promise<void>;
}) {
  const { theme, toggleTheme } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <button
          onClick={onPrevMonth}
          className="rounded-lg pr-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setPickerOpen(true)}
          className="min-w-[120px] rounded-xl border border-zinc-300 bg-white px-2 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm outline-none hover:bg-zinc-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          {monthLabel(year, monthIndex)}
        </button>
        <button
          onClick={onNextMonth}
          className="rounded-lg pl-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={toggleTheme} 
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className="h-8 w-8"
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
        <Button variant="outline" size="icon" onClick={onSignOut} title="Sign out" className="h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <MonthYearPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        year={year}
        monthIndex={monthIndex}
        onSelect={onSelectMonth}
      />
    </div>
  );
}

function MonthYearPicker({
  open,
  onOpenChange,
  year,
  monthIndex,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  monthIndex: number;
  onSelect: (year: number, monthIndex: number) => void;
}) {
  const [tempYear, setTempYear] = useState(year);
  const [tempMonthIndex, setTempMonthIndex] = useState(monthIndex);
  const [wasOpen, setWasOpen] = useState(false);
  
  const monthScrollRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);
  const isRepositioning = useRef(false);

  // Generate years (10 years back, 10 years forward)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  // Create repeating months for infinite scroll effect (3 full cycles for smoother looping)
  const REPEAT_COUNT = 3;
  const MIDDLE_CYCLE = 1;
  const ITEM_HEIGHT = 40; // h-10 = 40px
  const VIEWPORT_HEIGHT = 176; // h-44 = 176px
  
  const repeatedMonths = Array.from({ length: MONTH_NAMES.length * REPEAT_COUNT }, (_, i) => ({
    index: i % 12,
    name: MONTH_NAMES[i % 12],
    cycle: Math.floor(i / 12),
    uniqueKey: i,
  }));

  // Reset temp values when opening (using derived state pattern)
  if (open && !wasOpen) {
    setWasOpen(true);
    setTempYear(year);
    setTempMonthIndex(monthIndex);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // Scroll to the middle cycle on initial open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        const scrollContainer = monthScrollRef.current;
        if (scrollContainer) {
          // Calculate scroll position to center the selected month in middle cycle
          const targetIndex = MIDDLE_CYCLE * 12 + tempMonthIndex;
          const scrollTop = targetIndex * ITEM_HEIGHT - (VIEWPORT_HEIGHT / 2) + (ITEM_HEIGHT / 2);
          scrollContainer.scrollTop = scrollTop;
        }
        const yearItem = yearListRef.current?.querySelector(`[data-year="${tempYear}"]`);
        yearItem?.scrollIntoView({ block: "center", behavior: "instant" });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, tempMonthIndex, tempYear]);

  // Handle infinite scroll repositioning
  const handleMonthScroll = () => {
    const scrollContainer = monthScrollRef.current;
    if (!scrollContainer || isRepositioning.current) return;

    const scrollTop = scrollContainer.scrollTop;
    const singleCycleHeight = 12 * ITEM_HEIGHT;
    
    // If scrolled too far up (into first cycle), jump to middle cycle
    if (scrollTop < singleCycleHeight * 0.5) {
      isRepositioning.current = true;
      scrollContainer.scrollTop = scrollTop + singleCycleHeight;
      requestAnimationFrame(() => {
        isRepositioning.current = false;
      });
    }
    // If scrolled too far down (into last cycle), jump to middle cycle
    else if (scrollTop > singleCycleHeight * 1.5) {
      isRepositioning.current = true;
      scrollContainer.scrollTop = scrollTop - singleCycleHeight;
      requestAnimationFrame(() => {
        isRepositioning.current = false;
      });
    }
  };

  const handleConfirm = () => {
    onSelect(tempYear, tempMonthIndex);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)} 
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Cancel
          </button>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Select Month
          </span>
          <button
            onClick={handleConfirm}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Done
          </button>
        </div>

        <div className="flex gap-2">
          {/* Month picker wheel - infinite cycling */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-linear-to-b from-white to-transparent dark:from-zinc-900" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-linear-to-t from-white to-transparent dark:from-zinc-900" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-10 -translate-y-1/2 rounded-lg border-2 border-blue-500/30 bg-blue-50/50 dark:border-blue-400/30 dark:bg-blue-900/20" />
            
            <div 
              ref={monthScrollRef}
              className="h-44 overflow-y-auto scrollbar-hide"
              onScroll={handleMonthScroll}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="py-[68px]">
                {repeatedMonths.map((month) => (
                  <button
                    key={month.uniqueKey}
                    onClick={() => setTempMonthIndex(month.index)}
                    className={cn(
                      "flex h-10 w-full items-center justify-center text-sm transition-all",
                      tempMonthIndex === month.index
                        ? "font-bold text-blue-600 dark:text-blue-400 scale-105"
                        : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400"
                    )}
                  >
                    {month.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Year picker wheel */}
          <div className="relative w-24">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-linear-to-b from-white to-transparent dark:from-zinc-900" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-linear-to-t from-white to-transparent dark:from-zinc-900" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-10 -translate-y-1/2 rounded-lg border-2 border-blue-500/30 bg-blue-50/50 dark:border-blue-400/30 dark:bg-blue-900/20" />
            
            <ScrollArea className="h-44">
              <div ref={yearListRef} className="py-[68px]">
                {years.map((y) => (
                  <button
                    key={y}
                    data-year={y}
                    onClick={() => setTempYear(y)}
                    className={cn(
                      "flex h-10 w-full items-center justify-center text-sm transition-all",
                      tempYear === y
                        ? "font-bold text-blue-600 dark:text-blue-400 scale-105"
                        : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400"
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceCard({
  startingBalance,
  current,
  projected,
  currency,
  onUpdateStartingBalance,
}: {
  startingBalance: number;
  current: number;
  projected: number;
  currency: string;
  onUpdateStartingBalance: (newBalance: number) => Promise<void>;
}) {
  const [isEditingStarting, setIsEditingStarting] = useState(false);
  const [editValue, setEditValue] = useState("");

  const startEdit = () => {
    setEditValue((startingBalance / 100).toString());
    setIsEditingStarting(true);
  };

  const cancelEdit = () => {
    setIsEditingStarting(false);
    setEditValue("");
  };

  const saveEdit = async () => {
    const newCents = toCents(editValue);
    await onUpdateStartingBalance(newCents);
    setIsEditingStarting(false);
    setEditValue("");
  };

  const startingColor =
    startingBalance > 0 ? "text-emerald-600" : startingBalance < 0 ? "text-rose-600" : "text-zinc-800 dark:text-zinc-200";

  const currentColor =
    current > 0 ? "text-emerald-600" : current < 0 ? "text-rose-600" : "text-zinc-800 dark:text-zinc-200";

  const projectedColor =
    projected > 0
      ? "text-emerald-600"
      : projected < 0
        ? "text-rose-600"
        : "text-zinc-800 dark:text-zinc-200";

  return (
    <Card className="bg-white dark:bg-zinc-900">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Starting Balance */}
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Starting
            </p>
            {isEditingStarting ? (
              <div className="mt-1 flex items-center gap-1">
                <span className="text-sm text-zinc-500">$</span>
                <Input
                  autoFocus
                  inputMode="decimal"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="h-7 w-20 text-sm font-semibold"
                />
                <button
                  onClick={saveEdit}
                  className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                  aria-label="Save"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className={cn("text-base font-semibold", startingColor)}>
                  {formatCurrency(startingBalance, currency)}
                </p>
                <button
                  onClick={startEdit}
                  className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  aria-label="Edit starting balance"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Running Balance - Primary/highlighted */}
          <div className="rounded-lg bg-blue-50 p-3 ring-1 ring-blue-100 dark:bg-blue-900/20 dark:ring-blue-800/50">
            <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Running
            </p>
            <p className={cn("text-base font-semibold", currentColor)}>
              {formatCurrency(current, currency)}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Paid items
            </p>
          </div>

          {/* Projected Balance */}
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Projected
            </p>
            <p className={cn("text-base font-semibold", projectedColor)}>
              {formatCurrency(projected, currency)}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              All items
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionRow({
  transaction,
  projectedBalance,
  currency,
  isDragging,
  onTogglePaid,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  projectedBalance: number;
  currency: string;
  isDragging?: boolean;
  onTogglePaid: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: transaction._id,
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const color =
    transaction.type === "income"
      ? "text-emerald-600"
      : transaction.type === "saving"
        ? "text-sky-600"
        : "text-rose-600";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 transition-all duration-200",
        (isDragging || isSortableDragging) && "opacity-40 scale-[0.98]"
      )}
    >
      <button
        className="flex h-10 w-6 items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {transaction.label}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Due: {transaction.date}</p>
          </div>
          <div className="text-right">
            <p className={cn("text-sm font-semibold", color)}>
              {formatCurrency(transaction.amountCents, currency)}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              After: {formatCurrency(projectedBalance ?? 0, currency)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={transaction.isPaid}
              onCheckedChange={(v) => onTogglePaid(Boolean(v))}
              aria-label="Mark as paid"
            />
            <Badge className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
              {transaction.type === "income"
                ? "Income"
                : transaction.type === "saving"
                  ? "Saving"
                  : "Bill"}
            </Badge>
            {transaction.isRecurring && (
              <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                Recurring
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionRowOverlay({
  transaction,
  projectedBalance,
  currency,
}: {
  transaction: Transaction;
  projectedBalance: number;
  currency: string;
}) {
  const color =
    transaction.type === "income"
      ? "text-emerald-600"
      : transaction.type === "saving"
        ? "text-sky-600"
        : "text-rose-600";

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-blue-400 bg-white p-3 shadow-xl dark:border-blue-500 dark:bg-zinc-900 ring-4 ring-blue-100 dark:ring-blue-900/50">
      <div className="flex h-10 w-6 items-center justify-center text-blue-500">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {transaction.label}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Due: {transaction.date}</p>
          </div>
          <div className="text-right">
            <p className={cn("text-sm font-semibold", color)}>
              {formatCurrency(transaction.amountCents, currency)}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              After: {formatCurrency(projectedBalance ?? 0, currency)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={transaction.isPaid}
              disabled
              aria-label="Mark as paid"
            />
            <Badge className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
              {transaction.type === "income"
                ? "Income"
                : transaction.type === "saving"
                  ? "Saving"
                  : "Bill"}
            </Badge>
            {transaction.isRecurring && (
              <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                Recurring
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg p-1 text-zinc-500"
              aria-label="Edit"
              disabled
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-lg p-1 text-rose-500"
              aria-label="Delete"
              disabled
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type TransactionFormValues = {
  label: string;
  type: "income" | "bill" | "saving";
  amountCents: number;
  date: string;
  order: number;
  category?: string;
  isRecurring: boolean;
  isTemplateOnly: boolean;
  mode: "fixed" | "percentage";
  savingsPercentage?: number;
  linkedIncomeId?: string;
};

function TransactionFormSheet({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  transaction,
  incomes,
  nextOrder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  onDelete?: () => void;
  transaction: Transaction | null;
  incomes: Transaction[];
  nextOrder: number;
}) {
  const [form, setForm] = useState<TransactionFormValues>(() =>
    transaction
      ? {
          label: transaction.label,
          type: transaction.type,
          amountCents: transaction.amountCents,
          date: transaction.date,
          order: transaction.order,
          category: transaction.category,
          isRecurring: transaction.isRecurring,
          isTemplateOnly: transaction.isTemplateOnly,
          mode: transaction.mode,
          savingsPercentage: transaction.savingsPercentage,
          linkedIncomeId: transaction.linkedIncomeId,
        }
      : {
          label: "",
          type: "bill",
          amountCents: 0,
          date: "",
          order: nextOrder,
          isRecurring: false,
          isTemplateOnly: false,
          category: "",
          mode: "fixed",
          savingsPercentage: 0,
          linkedIncomeId: undefined,
        },
  );

  const isSaving = form.type === "saving";
  const computedAmount =
    isSaving && form.mode === "percentage"
      ? Math.round(
          ((form.savingsPercentage ?? 0) / 100) *
            (incomes.find((i) => i._id === form.linkedIncomeId)?.amountCents ?? 0),
        )
      : form.amountCents;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={transaction ? "Edit item" : "Add item"}>
        <SheetHeader>
          <SheetTitle>{transaction ? "Edit item" : "Add new item"}</SheetTitle>
        </SheetHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              ...form,
              amountCents: computedAmount,
            });
          }}
        >
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Label
            </label>
            <Input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Type
              </label>
              <select
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as Transaction["type"],
                    mode: e.target.value === "saving" ? "percentage" : "fixed",
                  }))
                }
              >
                <option value="income">Income</option>
                <option value="bill">Bill</option>
                <option value="saving">Saving</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Date (e.g. 15 or 2025-12-15)
              </label>
              <Input
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                placeholder="15"
                required
              />
            </div>
          </div>

          {!isSaving && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Amount
              </label>
              <Input
                inputMode="decimal"
                value={(form.amountCents / 100).toString()}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amountCents: toCents(e.target.value) }))
                }
                required
              />
            </div>
          )}

          {isSaving && (
            <div className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Savings mode
                </label>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900"
                  value={form.mode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mode: e.target.value as Transaction["mode"] }))
                  }
                >
                  <option value="percentage">Percentage of income</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              {form.mode === "percentage" ? (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      Percentage
                    </label>
                    <Input
                      inputMode="decimal"
                      value={form.savingsPercentage?.toString() ?? "0"}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          savingsPercentage: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      Linked income
                    </label>
                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900"
                      value={form.linkedIncomeId ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          linkedIncomeId: e.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">Select income</option>
                      {incomes.map((income) => (
                        <option key={income._id} value={income._id}>
                          {income.label} ({formatCurrency(income.amountCents)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Computed amount: {formatCurrency(computedAmount)}
                  </p>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Amount
                  </label>
                  <Input
                    inputMode="decimal"
                    value={(form.amountCents / 100).toString()}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amountCents: toCents(e.target.value) }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <Checkbox
                checked={form.isRecurring}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isRecurring: Boolean(v) }))
                }
              />
              Recurring each month
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <Checkbox
                checked={form.isTemplateOnly}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isTemplateOnly: Boolean(v) }))
                }
              />
              Copy as template
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                className="text-rose-600 hover:bg-rose-50"
                onClick={onDelete}
              >
                Delete
              </Button>
            )}
            <Button type="submit" className="ml-auto">
              Save
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AuthScreen({
  onSignIn,
  onSignUp,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "signin") {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to authenticate");
      }
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-wide text-blue-600 dark:text-blue-400">Cash Flow Forecaster</p>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h1>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full">
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button
            className="w-full text-sm text-blue-600 underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Already registered? Sign in"}
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
