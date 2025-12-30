import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_ALGO,
  PASSWORD_HASH_VERSION,
  PASSWORD_ITERATIONS,
  hashPasswordV2WithSalt,
  verifyPassword,
} from "./auth";
import type { Doc, Id } from "./_generated/dataModel";

const demoSalt = "5b6a1f42c7d38e4a2c1f77b8a4d9c0e1";
const testUserId = "test-user" as Id<"users">;

function buildUser(overrides: Partial<Doc<"users">>): Doc<"users"> {
  return {
    _id: testUserId,
    _creationTime: Date.now(),
    email: "user@example.com",
    salt: demoSalt,
    ...overrides,
  };
}

async function hashPasswordV1ForTest(password: string, salt: string) {
  const data = new TextEncoder().encode(`${password}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

test("pbkdf2 hashing verifies correctly", async () => {
  const iterations = 10_000;
  const password = "StrongPassword!123";
  const hash = await hashPasswordV2WithSalt(password, demoSalt, iterations);

  const verification = await verifyPassword(
    password,
    buildUser({
      hash,
      iterations,
      hashVersion: PASSWORD_HASH_VERSION,
      algo: PASSWORD_ALGO,
    }),
  );

  assert.equal(verification.valid, true);
  assert.equal(verification.upgrade, undefined);

  const wrong = await verifyPassword(
    "wrong",
    buildUser({
      hash,
      iterations,
      hashVersion: PASSWORD_HASH_VERSION,
      algo: PASSWORD_ALGO,
    }),
  );

  assert.equal(wrong.valid, false);
});

test("v1 password upgrades to v2 on successful verify", async () => {
  const password = "Legacy#Pass1";
  const salt = "11223344556677889900aabbccddeeff";
  const passwordHash = await hashPasswordV1ForTest(password, salt);

  const verification = await verifyPassword(
    password,
    buildUser({
      email: "legacy@example.com",
      salt,
      passwordHash,
      hashVersion: 1,
    }),
  );

  assert.equal(verification.valid, true);
  assert.ok(verification.upgrade);
  assert.equal(verification.upgrade?.hashVersion, PASSWORD_HASH_VERSION);
  assert.equal(verification.upgrade?.iterations, PASSWORD_ITERATIONS);
  assert.equal(verification.upgrade?.algo, PASSWORD_ALGO);
  assert.equal(verification.upgrade?.hash.length, 64);
  assert.equal(verification.upgrade?.salt.length, 32);
  assert.notEqual(verification.upgrade?.salt, salt);
});

