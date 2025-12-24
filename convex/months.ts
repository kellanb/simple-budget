import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireSession } from "./utils";
import type { Doc } from "./_generated/dataModel";

const DEFAULT_CURRENCY = "USD";

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { user } = await requireSession(ctx, token);
    const months = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) => q.eq("userId", user._id))
      .collect();

    return months.sort((a, b) => {
      if (a.year === b.year) {
        return a.monthIndex - b.monthIndex;
      }
      return a.year - b.year;
    });
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    year: v.number(),
    monthIndex: v.number(),
    startingBalanceCents: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);
    return ctx.db.insert("months", {
      userId: user._id,
      name: args.name,
      year: args.year,
      monthIndex: args.monthIndex,
      startingBalanceCents: args.startingBalanceCents,
      currency: args.currency ?? DEFAULT_CURRENCY,
    });
  },
});

export const updateMeta = mutation({
  args: {
    token: v.string(),
    monthId: v.id("months"),
    name: v.optional(v.string()),
    startingBalanceCents: v.optional(v.number()),
    usePreviousMonthEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);
    const month = await ctx.db.get(args.monthId);
    if (!month || month.userId !== user._id) {
      throw new Error("Month not found");
    }

    const patch: {
      name?: string;
      startingBalanceCents?: number;
      usePreviousMonthEnd?: boolean;
    } = {};
    
    if (args.name !== undefined) {
      patch.name = args.name;
    }
    if (args.startingBalanceCents !== undefined) {
      patch.startingBalanceCents = args.startingBalanceCents;
    }
    if (args.usePreviousMonthEnd !== undefined) {
      patch.usePreviousMonthEnd = args.usePreviousMonthEnd;
    }

    await ctx.db.patch(args.monthId, patch);
  },
});

// Helper to calculate projected end balance from transactions
function calculateProjectedEndBalance(
  transactions: Array<Doc<"transactions">>,
  startingBalanceCents: number
): number {
  const sorted = [...transactions].sort((a, b) => a.order - b.order);
  
  // Build income lookup for percentage-based savings
  const incomeLookup = new Map<string, number>();
  for (const tx of sorted) {
    if (tx.type === "income") {
      incomeLookup.set(tx._id, tx.amountCents);
    }
  }
  
  let cumulative = startingBalanceCents;
  for (const tx of sorted) {
    let amountCents = tx.amountCents;
    
    // Resolve percentage-based savings
    if (tx.type === "saving" && tx.mode === "percentage" && tx.linkedIncomeId) {
      const incomeAmount = incomeLookup.get(tx.linkedIncomeId) ?? 0;
      const pct = tx.savingsPercentage ?? 0;
      amountCents = Math.round((incomeAmount * pct) / 100);
    }
    
    const delta = tx.type === "income" ? amountCents : -amountCents;
    cumulative += delta;
  }
  
  return cumulative;
}

export const getPreviousMonthProjectedEnd = query({
  args: {
    token: v.string(),
    year: v.number(),
    monthIndex: v.number(),
  },
  handler: async (ctx, { token, year, monthIndex }) => {
    const { user } = await requireSession(ctx, token);
    
    // Calculate previous month (handle year boundary)
    let prevYear = year;
    let prevMonthIndex = monthIndex - 1;
    if (prevMonthIndex < 0) {
      prevMonthIndex = 11;
      prevYear = year - 1;
    }
    
    // Find the previous month
    const prevMonth = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q.eq("userId", user._id).eq("year", prevYear).eq("monthIndex", prevMonthIndex)
      )
      .unique();
    
    if (!prevMonth) {
      return { exists: false, projectedEndCents: null };
    }
    
    // Get transactions for the previous month
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_month_order", (q) => q.eq("monthId", prevMonth._id))
      .collect();
    
    const projectedEndCents = calculateProjectedEndBalance(
      transactions,
      prevMonth.startingBalanceCents
    );
    
    return { exists: true, projectedEndCents };
  },
});

export const cloneMonthWithRecurring = mutation({
  args: {
    token: v.string(),
    fromMonthId: v.id("months"),
    toYear: v.number(),
    toMonthIndex: v.number(),
    startingBalanceCents: v.number(),
    copyNonRecurringAsZero: v.boolean(),
  },
  handler: async (
    ctx,
    { token, fromMonthId, toYear, toMonthIndex, startingBalanceCents, copyNonRecurringAsZero },
  ) => {
    const { user } = await requireSession(ctx, token);
    const source = await ctx.db.get(fromMonthId);
    if (!source || source.userId !== user._id) {
      throw new Error("Source month not found");
    }

    const newMonthId = await ctx.db.insert("months", {
      userId: user._id,
      name: source.name,
      year: toYear,
      monthIndex: toMonthIndex,
      startingBalanceCents,
      currency: source.currency ?? DEFAULT_CURRENCY,
    });

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_month_order", (q) => q.eq("monthId", fromMonthId))
      .collect();

    for (const tx of transactions) {
      const shouldCopy =
        tx.isRecurring || (copyNonRecurringAsZero && !tx.isRecurring);
      if (!shouldCopy) continue;

      const amountCents =
        tx.isRecurring || !copyNonRecurringAsZero ? tx.amountCents : 0;

      await ctx.db.insert("transactions", {
        monthId: newMonthId,
        userId: user._id,
        label: tx.label,
        type: tx.type,
        amountCents,
        date: tx.date,
        isPaid: false,
        order: tx.order,
        category: tx.category,
        isRecurring: tx.isRecurring,
        isTemplateOnly: tx.isTemplateOnly,
        mode: tx.mode,
        savingsPercentage: tx.savingsPercentage,
        linkedIncomeId: undefined,
      });
    }

    return newMonthId;
  },
});

