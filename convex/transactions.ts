import { mutation, query } from "./_generated/server";
import type { Id, MutationCtx, QueryCtx } from "./_generated/server";
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

