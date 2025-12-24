import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { clearSession, createSession, requireSession } from "./utils";

const HASH_VERSION = 2;
const PBKDF2_ITERATIONS = 300_000;
const DERIVED_KEY_LENGTH_BYTES = 32;
const ALGO_LABEL = "PBKDF2-SHA256";

export const PASSWORD_HASH_VERSION = HASH_VERSION;
export const PASSWORD_ITERATIONS = PBKDF2_ITERATIONS;
export const PASSWORD_ALGO = ALGO_LABEL;

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
  return toHex(buf.buffer);
}

function fromHex(hex: string) {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex input");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function hashPasswordV1(password: string, salt: string) {
  const data = new TextEncoder().encode(`${password}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

async function hashPasswordV2(password: string, salt: string, iterations = PBKDF2_ITERATIONS) {
  const encodedPassword = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey("raw", encodedPassword, "PBKDF2", false, ["deriveBits"]);
  const saltBytes = fromHex(salt);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations,
      hash: "SHA-256",
    },
    key,
    DERIVED_KEY_LENGTH_BYTES * 8,
  );
  return toHex(derivedBits);
}

function constantTimeEqualHex(a: string, b: string) {
  let mismatch = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const aCode = a.charCodeAt(i) || 0;
    const bCode = b.charCodeAt(i) || 0;
    mismatch |= aCode ^ bCode;
  }
  return mismatch === 0;
}

type PasswordUpgrade = {
  hashVersion: number;
  iterations: number;
  salt: string;
  hash: string;
  algo: string;
};

export async function verifyPassword(
  password: string,
  user: Doc<"users">,
): Promise<{ valid: boolean; upgrade?: PasswordUpgrade }> {
  const version = user.hashVersion ?? 1;

  if (version === HASH_VERSION) {
    const salt = user.salt ?? generateSalt();
    const iterations = user.iterations ?? PBKDF2_ITERATIONS;
    const derived = await hashPasswordV2(password, salt, iterations);
    const storedHash = user.hash ?? "";
    return { valid: constantTimeEqualHex(derived, storedHash) };
  }

  const expectedHash = await hashPasswordV1(password, user.salt);
  const storedHash = user.passwordHash ?? "";
  const valid = constantTimeEqualHex(expectedHash, storedHash);

  if (!valid) {
    return { valid: false };
  }

  const salt = generateSalt();
  const hash = await hashPasswordV2(password, salt, PBKDF2_ITERATIONS);

  return {
    valid: true,
    upgrade: {
      hashVersion: HASH_VERSION,
      iterations: PBKDF2_ITERATIONS,
      salt,
      hash,
      algo: ALGO_LABEL,
    },
  };
}

export async function hashPasswordV2WithSalt(password: string, salt: string, iterations = PBKDF2_ITERATIONS) {
  return hashPasswordV2(password, salt, iterations);
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
    const hash = await hashPasswordV2(password, salt);

    const userId = await ctx.db.insert("users", {
      email: normalized,
      salt,
      hash,
      iterations: PBKDF2_ITERATIONS,
      hashVersion: HASH_VERSION,
      algo: ALGO_LABEL,
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

    const verification = await verifyPassword(password, user);
    if (!verification.valid) {
      throw new Error("Invalid credentials");
    }

    if (verification.upgrade) {
      await ctx.db.patch(user._id, verification.upgrade);
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

