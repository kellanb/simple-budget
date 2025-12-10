import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type Ctx = MutationCtx | QueryCtx;

export async function requireSession(ctx: Ctx, token: string) {
  if (!token) {
    throw new Error("Missing session token");
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session) {
    throw new Error("Invalid session");
  }

  if (session.expiresAt < Date.now()) {
    if ("db" in ctx && "delete" in ctx.db) {
      await (ctx as MutationCtx).db.delete(session._id);
    }
    throw new Error("Session expired");
  }

  const user = await ctx.db.get(session.userId);
  if (!user) {
    throw new Error("User missing for session");
  }

  return { session, user };
}

export async function createSession(ctx: MutationCtx, userId: Id<"users">) {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days

  await ctx.db.insert("sessions", {
    userId,
    token,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function clearSession(ctx: MutationCtx, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (session) {
    await ctx.db.delete(session._id);
  }
}

