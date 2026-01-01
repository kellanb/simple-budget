import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireSession } from "./utils";

// Import section definitions from shared constants file for local use
import {
  YEARLY_SECTION_DEFS,
  YEARLY_SUBSECTION_SECTION_DEFS,
  type YearlySectionKey,
  type YearlySubsectionSectionKey,
} from "../src/lib/yearly-constants";

// Re-export for other files to use
export {
  YEARLY_SECTION_DEFS,
  YEARLY_SUBSECTION_SECTION_DEFS,
  type YearlySectionKey,
  type YearlySubsectionSectionKey,
};

// Validators for section keys
const sectionKeyValidator = v.union(
  v.literal("income"),
  v.literal("monthlyBills"),
  v.literal("nonMonthlyBills"),
  v.literal("debt"),
  v.literal("savings"),
  v.literal("investments"),
);

const subsectionSectionKeyValidator = v.union(
  v.literal("monthlyBills"),
  v.literal("nonMonthlyBills"),
  v.literal("debt"),
  v.literal("savings"),
  v.literal("investments"),
);

const frequencyValidator = v.union(
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("biannual"),
  v.literal("annual"),
  v.literal("irregular"),
);

const goalAmountTypeValidator = v.union(
  v.literal("custom"),
  v.literal("6months"),
  v.literal("12months"),
);

// ============================================================================
// Helper Functions
// ============================================================================

async function ensureSubsection(
  ctx: MutationCtx | QueryCtx,
  subsectionId: Id<"yearlySubsections">,
  userId: Id<"users">,
) {
  const subsection = await ctx.db.get(subsectionId);
  if (!subsection || subsection.userId !== userId) {
    throw new Error("Subsection not found");
  }
  return subsection;
}

async function ensureLineItem(
  ctx: MutationCtx | QueryCtx,
  lineItemId: Id<"yearlyLineItems">,
  userId: Id<"users">,
) {
  const item = await ctx.db.get(lineItemId);
  if (!item || item.userId !== userId) {
    throw new Error("Line item not found");
  }
  return item;
}

async function getMaxSubsectionOrder(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  year: number,
  sectionKey: YearlySubsectionSectionKey,
): Promise<number> {
  const subsections = await ctx.db
    .query("yearlySubsections")
    .withIndex("by_user_and_year_and_sectionKey", (q) =>
      q.eq("userId", userId).eq("year", year).eq("sectionKey", sectionKey),
    )
    .collect();

  if (subsections.length === 0) return -1;
  return Math.max(...subsections.map((s) => s.order));
}

async function getMaxLineItemOrder(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  year: number,
  sectionKey: YearlySectionKey,
  subsectionId: Id<"yearlySubsections"> | undefined,
): Promise<number> {
  if (subsectionId !== undefined) {
    // Items within a subsection
    const items = await ctx.db
      .query("yearlyLineItems")
      .withIndex("by_subsection_and_order", (q) =>
        q.eq("subsectionId", subsectionId),
      )
      .collect();
    if (items.length === 0) return -1;
    return Math.max(...items.map((i) => i.order));
  } else {
    // Section-level items (no subsection)
    const items = await ctx.db
      .query("yearlyLineItems")
      .withIndex("by_user_year_sectionKey_order", (q) =>
        q.eq("userId", userId).eq("year", year).eq("sectionKey", sectionKey),
      )
      .collect();
    // Filter to only section-level items (subsectionId undefined)
    const sectionLevelItems = items.filter((i) => i.subsectionId === undefined);
    if (sectionLevelItems.length === 0) return -1;
    return Math.max(...sectionLevelItems.map((i) => i.order));
  }
}

// ============================================================================
// Query: listForYear
// ============================================================================

// Line item validator for return type
const lineItemValidator = v.object({
  _id: v.id("yearlyLineItems"),
  _creationTime: v.number(),
  userId: v.id("users"),
  year: v.number(),
  sectionKey: sectionKeyValidator,
  subsectionId: v.optional(v.id("yearlySubsections")),
  label: v.string(),
  amountCents: v.number(),
  order: v.number(),
  note: v.optional(v.string()),
  paymentSource: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  frequency: v.optional(frequencyValidator),
  originalAmountCents: v.optional(v.number()),
  balanceCents: v.optional(v.number()),
  interestRate: v.optional(v.number()),
  goalAmountCents: v.optional(v.number()),
  goalAmountType: v.optional(goalAmountTypeValidator),
  currentAmountCents: v.optional(v.number()),
  startMonth: v.optional(v.string()),
  endMonth: v.optional(v.string()),
  paymentDay: v.optional(v.string()),
});

const subsectionWithItemsValidator = v.object({
  _id: v.id("yearlySubsections"),
  _creationTime: v.number(),
  userId: v.id("users"),
  year: v.number(),
  sectionKey: subsectionSectionKeyValidator,
  title: v.string(),
  order: v.number(),
  items: v.array(lineItemValidator),
});

export const listForYear = query({
  args: {
    token: v.string(),
    year: v.number(),
  },
  returns: v.object({
    subsections: v.array(subsectionWithItemsValidator),
    sectionItems: v.array(lineItemValidator),
  }),
  handler: async (ctx, { token, year }) => {
    const { user } = await requireSession(ctx, token);

    // Fetch all subsections for this user/year
    const allSubsections = await ctx.db
      .query("yearlySubsections")
      .withIndex("by_user_and_year", (q) =>
        q.eq("userId", user._id).eq("year", year),
      )
      .collect();

    // Fetch all line items for this user/year
    const allItems = await ctx.db
      .query("yearlyLineItems")
      .withIndex("by_user_and_year", (q) =>
        q.eq("userId", user._id).eq("year", year),
      )
      .collect();

    // Group items by subsectionId
    const itemsBySubsection = new Map<
      string | undefined,
      Doc<"yearlyLineItems">[]
    >();
    for (const item of allItems) {
      const key = item.subsectionId ?? undefined;
      const keyStr = key === undefined ? "__section__" : key;
      const existing = itemsBySubsection.get(keyStr) ?? [];
      existing.push(item);
      itemsBySubsection.set(keyStr, existing);
    }

    // Build subsections with their items
    const subsections = allSubsections
      .sort((a, b) => a.order - b.order)
      .map((sub) => {
        const subItems = itemsBySubsection.get(sub._id) ?? [];
        return {
          ...sub,
          items: subItems.sort((a, b) => a.order - b.order),
        };
      });

    // Section-level items (no subsection)
    const sectionItems = (itemsBySubsection.get("__section__") ?? []).sort(
      (a, b) => a.order - b.order,
    );

    return { subsections, sectionItems };
  },
});

// ============================================================================
// Query: listYearsWithData
// ============================================================================

export const listYearsWithData = query({
  args: {
    token: v.string(),
  },
  returns: v.array(v.number()),
  handler: async (ctx, { token }) => {
    const { user } = await requireSession(ctx, token);

    // Get all unique years from line items
    const lineItems = await ctx.db
      .query("yearlyLineItems")
      .withIndex("by_user_and_year", (q) => q.eq("userId", user._id))
      .collect();

    // Get all unique years from subsections
    const subsections = await ctx.db
      .query("yearlySubsections")
      .withIndex("by_user_and_year", (q) => q.eq("userId", user._id))
      .collect();

    // Combine and deduplicate years
    const yearsSet = new Set<number>();
    for (const item of lineItems) {
      yearsSet.add(item.year);
    }
    for (const sub of subsections) {
      yearsSet.add(sub.year);
    }

    // Return sorted array (descending - most recent first)
    return Array.from(yearsSet).sort((a, b) => b - a);
  },
});

// ============================================================================
// Subsection Mutations
// ============================================================================

export const createSubsection = mutation({
  args: {
    token: v.string(),
    year: v.number(),
    sectionKey: subsectionSectionKeyValidator,
    title: v.string(),
  },
  returns: v.id("yearlySubsections"),
  handler: async (ctx, { token, year, sectionKey, title }) => {
    const { user } = await requireSession(ctx, token);

    const maxOrder = await getMaxSubsectionOrder(
      ctx,
      user._id,
      year,
      sectionKey,
    );

    return ctx.db.insert("yearlySubsections", {
      userId: user._id,
      year,
      sectionKey,
      title,
      order: maxOrder + 1,
    });
  },
});

export const updateSubsection = mutation({
  args: {
    token: v.string(),
    subsectionId: v.id("yearlySubsections"),
    patch: v.object({
      title: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { token, subsectionId, patch }) => {
    const { user } = await requireSession(ctx, token);
    await ensureSubsection(ctx, subsectionId, user._id);
    await ctx.db.patch(subsectionId, patch);
    return null;
  },
});

export const removeSubsection = mutation({
  args: {
    token: v.string(),
    subsectionId: v.id("yearlySubsections"),
  },
  returns: v.null(),
  handler: async (ctx, { token, subsectionId }) => {
    const { user } = await requireSession(ctx, token);
    await ensureSubsection(ctx, subsectionId, user._id);

    // Cascade delete all items in this subsection
    const items = await ctx.db
      .query("yearlyLineItems")
      .withIndex("by_subsection_and_order", (q) =>
        q.eq("subsectionId", subsectionId),
      )
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    // Delete the subsection itself
    await ctx.db.delete(subsectionId);
    return null;
  },
});

export const reorderSubsections = mutation({
  args: {
    token: v.string(),
    year: v.number(),
    sectionKey: subsectionSectionKeyValidator,
    orderedIds: v.array(v.id("yearlySubsections")),
  },
  returns: v.null(),
  handler: async (ctx, { token, year, sectionKey, orderedIds }) => {
    const { user } = await requireSession(ctx, token);

    // Verify all subsections belong to user and match year/sectionKey
    for (let i = 0; i < orderedIds.length; i++) {
      const sub = await ensureSubsection(ctx, orderedIds[i], user._id);
      if (sub.year !== year || sub.sectionKey !== sectionKey) {
        throw new Error("Subsection does not match year or section");
      }
      await ctx.db.patch(orderedIds[i], { order: i });
    }

    return null;
  },
});

// ============================================================================
// Line Item Mutations
// ============================================================================

export const createLineItem = mutation({
  args: {
    token: v.string(),
    year: v.number(),
    sectionKey: sectionKeyValidator,
    subsectionId: v.optional(v.id("yearlySubsections")),
    label: v.string(),
    amountCents: v.number(),
    // Optional fields
    note: v.optional(v.string()),
    paymentSource: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    frequency: v.optional(frequencyValidator),
    originalAmountCents: v.optional(v.number()),
    balanceCents: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    goalAmountCents: v.optional(v.number()),
    goalAmountType: v.optional(goalAmountTypeValidator),
    currentAmountCents: v.optional(v.number()),
    startMonth: v.optional(v.string()),
    endMonth: v.optional(v.string()),
    paymentDay: v.optional(v.string()),
  },
  returns: v.id("yearlyLineItems"),
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);

    // Enforce: income items must not have a subsectionId
    if (args.sectionKey === "income" && args.subsectionId !== undefined) {
      throw new Error("Income items cannot have a subsection");
    }

    // If subsectionId provided, verify it exists and matches the sectionKey
    if (args.subsectionId !== undefined) {
      const sub = await ensureSubsection(ctx, args.subsectionId, user._id);
      if (sub.year !== args.year || sub.sectionKey !== args.sectionKey) {
        throw new Error("Subsection does not match year or section");
      }
    }

    const maxOrder = await getMaxLineItemOrder(
      ctx,
      user._id,
      args.year,
      args.sectionKey,
      args.subsectionId,
    );

    return ctx.db.insert("yearlyLineItems", {
      userId: user._id,
      year: args.year,
      sectionKey: args.sectionKey,
      subsectionId: args.subsectionId,
      label: args.label,
      amountCents: args.amountCents,
      order: maxOrder + 1,
      note: args.note,
      paymentSource: args.paymentSource,
      dueDate: args.dueDate,
      frequency: args.frequency,
      originalAmountCents: args.originalAmountCents,
      balanceCents: args.balanceCents,
      interestRate: args.interestRate,
      goalAmountCents: args.goalAmountCents,
      goalAmountType: args.goalAmountType,
      currentAmountCents: args.currentAmountCents,
      startMonth: args.startMonth,
      endMonth: args.endMonth,
      paymentDay: args.paymentDay,
    });
  },
});

export const updateLineItem = mutation({
  args: {
    token: v.string(),
    lineItemId: v.id("yearlyLineItems"),
    patch: v.object({
      label: v.optional(v.string()),
      amountCents: v.optional(v.number()),
      note: v.optional(v.string()),
      paymentSource: v.optional(v.string()),
      dueDate: v.optional(v.string()),
      frequency: v.optional(frequencyValidator),
      originalAmountCents: v.optional(v.number()),
      balanceCents: v.optional(v.number()),
      interestRate: v.optional(v.number()),
      goalAmountCents: v.optional(v.number()),
      goalAmountType: v.optional(goalAmountTypeValidator),
      currentAmountCents: v.optional(v.number()),
      startMonth: v.optional(v.string()),
      endMonth: v.optional(v.string()),
      paymentDay: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { token, lineItemId, patch }) => {
    const { user } = await requireSession(ctx, token);
    await ensureLineItem(ctx, lineItemId, user._id);
    await ctx.db.patch(lineItemId, patch);
    return null;
  },
});

export const removeLineItem = mutation({
  args: {
    token: v.string(),
    lineItemId: v.id("yearlyLineItems"),
  },
  returns: v.null(),
  handler: async (ctx, { token, lineItemId }) => {
    const { user } = await requireSession(ctx, token);
    await ensureLineItem(ctx, lineItemId, user._id);
    await ctx.db.delete(lineItemId);
    return null;
  },
});

export const reorderLineItems = mutation({
  args: {
    token: v.string(),
    year: v.number(),
    sectionKey: sectionKeyValidator,
    subsectionId: v.optional(v.id("yearlySubsections")),
    orderedIds: v.array(v.id("yearlyLineItems")),
  },
  returns: v.null(),
  handler: async (ctx, { token, year, sectionKey, subsectionId, orderedIds }) => {
    const { user } = await requireSession(ctx, token);

    // If subsectionId provided, verify it
    if (subsectionId !== undefined) {
      const sub = await ensureSubsection(ctx, subsectionId, user._id);
      if (sub.year !== year || sub.sectionKey !== sectionKey) {
        throw new Error("Subsection does not match year or section");
      }
    }

    // Verify all items belong to user and match year/sectionKey/subsectionId
    for (let i = 0; i < orderedIds.length; i++) {
      const item = await ensureLineItem(ctx, orderedIds[i], user._id);
      if (
        item.year !== year ||
        item.sectionKey !== sectionKey ||
        item.subsectionId !== subsectionId
      ) {
        throw new Error("Line item does not match year, section, or subsection");
      }
      await ctx.db.patch(orderedIds[i], { order: i });
    }

    return null;
  },
});

export const moveLineItem = mutation({
  args: {
    token: v.string(),
    lineItemId: v.id("yearlyLineItems"),
    toSubsectionId: v.optional(v.id("yearlySubsections")),
    sourceOrderedIds: v.array(v.id("yearlyLineItems")),
    destOrderedIds: v.array(v.id("yearlyLineItems")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);

    const item = await ensureLineItem(ctx, args.lineItemId, user._id);

    // Income items cannot be moved to subsections
    if (item.sectionKey === "income" && args.toSubsectionId !== undefined) {
      throw new Error("Income items cannot be moved to subsections");
    }

    // If destination is a subsection, verify it exists and has same sectionKey
    if (args.toSubsectionId !== undefined) {
      const destSub = await ensureSubsection(
        ctx,
        args.toSubsectionId,
        user._id,
      );
      if (
        destSub.year !== item.year ||
        destSub.sectionKey !== item.sectionKey
      ) {
        throw new Error("Cannot move item to a different section");
      }
    }

    // Update the item's subsectionId
    await ctx.db.patch(args.lineItemId, {
      subsectionId: args.toSubsectionId,
    });

    // Reorder source container (items remaining after move)
    for (let i = 0; i < args.sourceOrderedIds.length; i++) {
      const srcItem = await ensureLineItem(ctx, args.sourceOrderedIds[i], user._id);
      if (
        srcItem.year !== item.year ||
        srcItem.sectionKey !== item.sectionKey ||
        srcItem.subsectionId !== item.subsectionId
      ) {
        throw new Error("Line item does not match source container");
      }
      // Only patch if it's in the source container
      if (srcItem._id !== args.lineItemId) {
        await ctx.db.patch(args.sourceOrderedIds[i], { order: i });
      }
    }

    // Validate destination order - must include the moved item and only destination items
    if (!args.destOrderedIds.includes(args.lineItemId)) {
      throw new Error("Destination order must include the moved item");
    }

    for (let i = 0; i < args.destOrderedIds.length; i++) {
      const destItem = await ensureLineItem(ctx, args.destOrderedIds[i], user._id);
      if (
        destItem.year !== item.year ||
        destItem.sectionKey !== item.sectionKey ||
        destItem.subsectionId !== args.toSubsectionId
      ) {
        throw new Error("Line item does not match destination container");
      }
    }

    // Reorder destination container (includes the moved item)
    for (let i = 0; i < args.destOrderedIds.length; i++) {
      await ctx.db.patch(args.destOrderedIds[i], { order: i });
    }

    return null;
  },
});

// ============================================================================
// Copy from Year Mutation
// ============================================================================

export const copyFromYear = mutation({
  args: {
    token: v.string(),
    sourceYear: v.number(),
    targetYear: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { token, sourceYear, targetYear }) => {
    const { user } = await requireSession(ctx, token);

    // Verify source and target years are different
    if (sourceYear === targetYear) {
      throw new Error("Source and target years must be different");
    }

    // Fetch all subsections from source year
    const sourceSubsections = await ctx.db
      .query("yearlySubsections")
      .withIndex("by_user_and_year", (q) =>
        q.eq("userId", user._id).eq("year", sourceYear),
      )
      .collect();

    // Fetch all line items from source year
    const sourceItems = await ctx.db
      .query("yearlyLineItems")
      .withIndex("by_user_and_year", (q) =>
        q.eq("userId", user._id).eq("year", sourceYear),
      )
      .collect();

    // Verify source year has data
    if (sourceSubsections.length === 0 && sourceItems.length === 0) {
      throw new Error("Source year has no data to copy");
    }

    // Check if target year already has data
    const existingTargetSubsections = await ctx.db
      .query("yearlySubsections")
      .withIndex("by_user_and_year", (q) =>
        q.eq("userId", user._id).eq("year", targetYear),
      )
      .collect();

    const existingTargetItems = await ctx.db
      .query("yearlyLineItems")
      .withIndex("by_user_and_year", (q) =>
        q.eq("userId", user._id).eq("year", targetYear),
      )
      .collect();

    if (existingTargetSubsections.length > 0 || existingTargetItems.length > 0) {
      throw new Error("Target year already has data");
    }

    // Create a mapping from old subsection IDs to new subsection IDs
    const subsectionIdMap = new Map<Id<"yearlySubsections">, Id<"yearlySubsections">>();

    // Copy all subsections
    for (const sub of sourceSubsections) {
      const newSubId = await ctx.db.insert("yearlySubsections", {
        userId: user._id,
        year: targetYear,
        sectionKey: sub.sectionKey,
        title: sub.title,
        order: sub.order,
      });
      subsectionIdMap.set(sub._id, newSubId);
    }

    // Copy all line items
    for (const item of sourceItems) {
      // Map the subsectionId if it exists
      const newSubsectionId = item.subsectionId
        ? subsectionIdMap.get(item.subsectionId)
        : undefined;

      await ctx.db.insert("yearlyLineItems", {
        userId: user._id,
        year: targetYear,
        sectionKey: item.sectionKey,
        subsectionId: newSubsectionId,
        label: item.label,
        amountCents: item.amountCents,
        order: item.order,
        note: item.note,
        paymentSource: item.paymentSource,
        dueDate: item.dueDate,
        frequency: item.frequency,
        originalAmountCents: item.originalAmountCents,
        balanceCents: item.balanceCents,
        interestRate: item.interestRate,
        goalAmountCents: item.goalAmountCents,
        goalAmountType: item.goalAmountType,
        currentAmountCents: item.currentAmountCents,
        startMonth: item.startMonth,
        endMonth: item.endMonth,
        paymentDay: item.paymentDay,
      });
    }

    return null;
  },
});

