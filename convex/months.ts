import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireSession } from "./utils";

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
  },
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);
    const month = await ctx.db.get(args.monthId);
    if (!month || month.userId !== user._id) {
      throw new Error("Month not found");
    }

    await ctx.db.patch(args.monthId, {
      name: args.name ?? month.name,
      startingBalanceCents:
        args.startingBalanceCents ?? month.startingBalanceCents,
    });
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

