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

  // Yearly Forecast tables
  yearlySubsections: defineTable({
    userId: v.id("users"),
    year: v.number(),
    sectionKey: v.union(
      v.literal("monthlyBills"),
      v.literal("nonMonthlyBills"),
      v.literal("debt"),
      v.literal("savings"),
      v.literal("investments"),
    ),
    title: v.string(),
    order: v.number(),
  })
    .index("by_user_and_year_and_sectionKey", ["userId", "year", "sectionKey"])
    .index("by_user_and_year", ["userId", "year"]),

  yearlyLineItems: defineTable({
    userId: v.id("users"),
    year: v.number(),
    sectionKey: v.union(
      v.literal("income"),
      v.literal("monthlyBills"),
      v.literal("nonMonthlyBills"),
      v.literal("debt"),
      v.literal("savings"),
      v.literal("investments"),
    ),
    // Optional: items can exist at the section level (no subsection) or inside a subsection.
    // Constraint: income items must not have a subsectionId.
    subsectionId: v.optional(v.id("yearlySubsections")),
    label: v.string(),
    amountCents: v.number(), // Canonical monthly amount for totals (0 allowed for placeholder rows)
    order: v.number(),
    // Display fields
    note: v.optional(v.string()),
    paymentSource: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    // Non-monthly normalization
    frequency: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("biannual"),
        v.literal("annual"),
      ),
    ),
    originalAmountCents: v.optional(v.number()), // Pre-normalized amount
    // Debt fields
    balanceCents: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    // Savings fields
    goalAmountCents: v.optional(v.number()),
    currentAmountCents: v.optional(v.number()),
    // Month+year strings (sheet-like): e.g. "Jan 2026", "Dec 2027"
    startMonth: v.optional(v.string()),
    endMonth: v.optional(v.string()),
    // Investments fields (bi-monthly is derived as amountCents / 2, but we store paymentDay separately)
    paymentDay: v.optional(v.string()), // e.g. "16th" - day of month for investment contributions
  })
    .index("by_subsection_and_order", ["subsectionId", "order"])
    .index("by_user_year_sectionKey_order", [
      "userId",
      "year",
      "sectionKey",
      "order",
    ])
    .index("by_user_and_year", ["userId", "year"]),
});

