import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.optional(v.string()),
    salt: v.string(),
    hash: v.optional(v.string()),
    iterations: v.optional(v.number()),
    hashVersion: v.optional(v.number()),
    algo: v.optional(v.string()),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  months: defineTable({
    userId: v.id("users"),
    name: v.string(),
    year: v.number(),
    monthIndex: v.number(),
    startingBalanceCents: v.number(),
    currency: v.string(),
    usePreviousMonthEnd: v.optional(v.boolean()),
  }).index("by_user_and_month", ["userId", "year", "monthIndex"]),

  transactions: defineTable({
    monthId: v.id("months"),
    userId: v.id("users"),
    label: v.string(),
    type: v.union(v.literal("income"), v.literal("bill"), v.literal("saving")),
    amountCents: v.number(),
    date: v.string(),
    isPaid: v.boolean(),
    order: v.number(),
    category: v.optional(v.string()),
    isRecurring: v.boolean(),
    isTemplateOnly: v.boolean(),
    mode: v.union(v.literal("fixed"), v.literal("percentage")),
    savingsPercentage: v.optional(v.number()),
    linkedIncomeId: v.optional(v.id("transactions")),
  })
    .index("by_month_order", ["monthId", "order"])
    .index("by_user", ["userId"]),
});

