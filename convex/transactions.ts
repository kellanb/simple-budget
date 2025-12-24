import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireSession } from "./utils";

async function ensureMonth(
  ctx: MutationCtx | QueryCtx,
  monthId: Id<"months">,
  userId: Id<"users">,
) {
  const month = await ctx.db.get(monthId);
  if (!month || month.userId !== userId) {
    throw new Error("Month not found");
  }
  return month;
}

async function ensureTransaction(
  ctx: MutationCtx | QueryCtx,
  transactionId: Id<"transactions">,
  userId: Id<"users">,
) {
  const tx = await ctx.db.get(transactionId);
  if (!tx || tx.userId !== userId) {
    throw new Error("Transaction not found");
  }
  return tx;
}

export const listForMonth = query({
  args: { token: v.string(), monthId: v.id("months") },
  handler: async (ctx, { token, monthId }) => {
    const { user } = await requireSession(ctx, token);
    await ensureMonth(ctx, monthId, user._id);

    const items = await ctx.db
      .query("transactions")
      .withIndex("by_month_order", (q) => q.eq("monthId", monthId))
      .collect();

    return items.sort((a, b) => a.order - b.order);
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    monthId: v.id("months"),
    label: v.string(),
    type: v.union(v.literal("income"), v.literal("bill"), v.literal("saving")),
    amountCents: v.number(),
    date: v.string(),
    order: v.number(),
    category: v.optional(v.string()),
    isRecurring: v.boolean(),
    isTemplateOnly: v.boolean(),
    mode: v.union(v.literal("fixed"), v.literal("percentage")),
    savingsPercentage: v.optional(v.number()),
    linkedIncomeId: v.optional(v.id("transactions")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);
    await ensureMonth(ctx, args.monthId, user._id);

    return ctx.db.insert("transactions", {
      monthId: args.monthId,
      userId: user._id,
      label: args.label,
      type: args.type,
      amountCents: args.amountCents,
      date: args.date,
      isPaid: false,
      order: args.order,
      category: args.category,
      isRecurring: args.isRecurring,
      isTemplateOnly: args.isTemplateOnly,
      mode: args.mode,
      savingsPercentage: args.savingsPercentage,
      linkedIncomeId: args.linkedIncomeId,
    });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    transactionId: v.id("transactions"),
    patch: v.object({
      label: v.optional(v.string()),
      amountCents: v.optional(v.number()),
      date: v.optional(v.string()),
      isPaid: v.optional(v.boolean()),
      order: v.optional(v.number()),
      category: v.optional(v.string()),
      isRecurring: v.optional(v.boolean()),
      isTemplateOnly: v.optional(v.boolean()),
      mode: v.optional(v.union(v.literal("fixed"), v.literal("percentage"))),
      savingsPercentage: v.optional(v.number()),
      linkedIncomeId: v.optional(v.id("transactions")),
      type: v.optional(
        v.union(v.literal("income"), v.literal("bill"), v.literal("saving")),
      ),
    }),
  },
  handler: async (ctx, { token, transactionId, patch }) => {
    const { user } = await requireSession(ctx, token);
    await ensureTransaction(ctx, transactionId, user._id);
    await ctx.db.patch(transactionId, patch);
  },
});

export const remove = mutation({
  args: { token: v.string(), transactionId: v.id("transactions") },
  handler: async (ctx, { token, transactionId }) => {
    const { user } = await requireSession(ctx, token);
    await ensureTransaction(ctx, transactionId, user._id);
    await ctx.db.delete(transactionId);
  },
});

export const reorder = mutation({
  args: {
    token: v.string(),
    monthId: v.id("months"),
    orderedIds: v.array(v.id("transactions")),
  },
  handler: async (ctx, { token, monthId, orderedIds }) => {
    const { user } = await requireSession(ctx, token);
    await ensureMonth(ctx, monthId, user._id);

    for (let i = 0; i < orderedIds.length; i++) {
      await ensureTransaction(ctx, orderedIds[i], user._id);
      await ctx.db.patch(orderedIds[i], { order: i });
    }
  },
});

// Helper to parse date for sorting (empty/invalid dates go to end)
function parseDateForSort(date: string): number {
  const day = parseInt(date, 10);
  return isNaN(day) || date === "" ? 999 : day;
}

export const sortByDueDate = mutation({
  args: {
    token: v.string(),
    monthId: v.id("months"),
  },
  returns: v.null(),
  handler: async (ctx, { token, monthId }) => {
    const { user } = await requireSession(ctx, token);
    await ensureMonth(ctx, monthId, user._id);

    // Fetch all transactions for this month
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_month_order", (q) => q.eq("monthId", monthId))
      .collect();

    // Sort by date (ascending), empty dates go to end
    // Use existing order as tiebreaker for stability
    const sorted = [...transactions].sort((a, b) => {
      const dayA = parseDateForSort(a.date);
      const dayB = parseDateForSort(b.date);
      if (dayA !== dayB) return dayA - dayB;
      return a.order - b.order;
    });

    // Update order for each transaction
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].order !== i) {
        await ctx.db.patch(sorted[i]._id, { order: i });
      }
    }

    return null;
  },
});

export const togglePaid = mutation({
  args: {
    token: v.string(),
    transactionId: v.id("transactions"),
    isPaid: v.boolean(),
  },
  handler: async (ctx, { token, transactionId, isPaid }) => {
    const { user } = await requireSession(ctx, token);
    await ensureTransaction(ctx, transactionId, user._id);
    await ctx.db.patch(transactionId, { isPaid });
  },
});

export const updateSavingsConfig = mutation({
  args: {
    token: v.string(),
    transactionId: v.id("transactions"),
    mode: v.union(v.literal("fixed"), v.literal("percentage")),
    savingsPercentage: v.optional(v.number()),
    linkedIncomeId: v.optional(v.id("transactions")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);
    await ensureTransaction(ctx, args.transactionId, user._id);
    await ctx.db.patch(args.transactionId, {
      mode: args.mode,
      savingsPercentage: args.savingsPercentage,
      linkedIncomeId: args.linkedIncomeId,
    });
  },
});

// Helper to get number of days in a month
function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export const copyFromMonth = mutation({
  args: {
    token: v.string(),
    sourceMonthId: v.id("months"),
    targetYear: v.number(),
    targetMonthIndex: v.number(),
    includeDays: v.boolean(),
    includeAmounts: v.boolean(),
  },
  returns: v.id("months"),
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);

    // Verify source month belongs to user
    const sourceMonth = await ctx.db.get(args.sourceMonthId);
    if (!sourceMonth || sourceMonth.userId !== user._id) {
      throw new Error("Source month not found");
    }

    // Check if target month already exists
    const existingMonth = await ctx.db
      .query("months")
      .withIndex("by_user_and_month", (q) =>
        q
          .eq("userId", user._id)
          .eq("year", args.targetYear)
          .eq("monthIndex", args.targetMonthIndex)
      )
      .unique();

    let targetMonthId: Id<"months">;

    if (existingMonth) {
      targetMonthId = existingMonth._id;
    } else {
      // Create the target month with 0 starting balance
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      targetMonthId = await ctx.db.insert("months", {
        userId: user._id,
        name: `${monthNames[args.targetMonthIndex]} ${args.targetYear}`,
        year: args.targetYear,
        monthIndex: args.targetMonthIndex,
        startingBalanceCents: 0,
        currency: sourceMonth.currency,
      });
    }

    // Get all transactions from source month
    const sourceTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_month_order", (q) => q.eq("monthId", args.sourceMonthId))
      .collect();

    // Get max days in target month
    const targetMaxDays = getDaysInMonth(args.targetYear, args.targetMonthIndex);

    // Copy each transaction
    for (const tx of sourceTransactions) {
      let newDate = "";
      if (args.includeDays) {
        const sourceDay = parseInt(tx.date, 10);
        // If the source day exceeds target month's days, leave blank
        if (!isNaN(sourceDay) && sourceDay <= targetMaxDays) {
          newDate = tx.date;
        }
        // Otherwise newDate stays "" (blank)
      }
      // If includeDays is false, newDate stays "" (blank)

      await ctx.db.insert("transactions", {
        monthId: targetMonthId,
        userId: user._id,
        label: tx.label,
        type: tx.type,
        amountCents: args.includeAmounts ? tx.amountCents : 0,
        date: newDate,
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

    return targetMonthId;
  },
});

