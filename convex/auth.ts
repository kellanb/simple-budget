import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { clearSession, createSession, requireSession } from "./utils";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSalt(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return toHex(buf);
}

async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${password}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({
    token: v.string(),
    expiresAt: v.number(),
    userId: v.id("users"),
    email: v.string(),
  }),
  handler: async (ctx, { email, password }) => {
    const normalized = normalizeEmail(email);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (existing) {
      throw new Error("Email already registered");
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const userId = await ctx.db.insert("users", {
      email: normalized,
      salt,
      passwordHash,
    });

    const session = await createSession(ctx, userId);
    return { token: session.token, expiresAt: session.expiresAt, userId, email: normalized };
  },
});

export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({
    token: v.string(),
    expiresAt: v.number(),
    userId: v.id("users"),
    email: v.string(),
  }),
  handler: async (ctx, { email, password }) => {
    const normalized = normalizeEmail(email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const expectedHash = await hashPassword(password, user.salt);
    if (expectedHash !== user.passwordHash) {
      throw new Error("Invalid credentials");
    }

    const session = await createSession(ctx, user._id);
    return { token: session.token, expiresAt: session.expiresAt, userId: user._id, email: normalized };
  },
});

export const getSession = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      email: v.string(),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, { token }) => {
    try {
      const { session, user } = await requireSession(ctx, token);
      return { userId: user._id, email: user.email, expiresAt: session.expiresAt };
    } catch {
      return null;
    }
  },
});

export const signOut = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    await clearSession(ctx, token);
    return null;
  },
});

