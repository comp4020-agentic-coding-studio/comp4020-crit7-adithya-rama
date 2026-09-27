import {
  createHash,
  randomBytes,
  type ScryptOptions,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { AstroCookies } from "astro";
import { db } from "./db";
import { loginAttempts, sessions, users, type User } from "./schema";

// Not promisify(): its type resolves to scrypt's 3-argument overload, which
// drops the options object, so the cost parameters below would be accepted and
// then silently ignored — leaving every password on scrypt's weaker defaults.
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

// scrypt is deliberately memory-hard: N=16384,r=8 costs ~16MB per hash. The
// Fly machine has 256MB total, so unbounded concurrent sign-ins would OOM the
// box rather than merely slow it down.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;
const MAX_CONCURRENT_HASHES = 2;

let active = 0;
const waiting: Array<() => void> = [];

async function withHashSlot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_HASHES) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active++;
  try {
    return await work();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return withHashSlot(() =>
    scryptAsync(password.normalize("NFKC"), salt, SCRYPT.keylen, {
      N: SCRYPT.N,
      r: SCRYPT.r,
      p: SCRYPT.p,
    }),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, , , , saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await derive(password, Buffer.from(saltB64, "base64"));
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Session expiry is compared against SQLite's datetime('now'), which is a
// space-separated UTC string. An ISO timestamp's "T" sorts after every digit,
// so storing one would make expired sessions compare as still valid.
function sqliteDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function createUser(
  rawUsername: string,
  password: string,
): Promise<{ user: User; recoveryCode: string }> {
  const recoveryCode = randomBytes(12).toString("base64url");
  const [passwordHash, recoveryCodeHash] = await Promise.all([
    hashPassword(password),
    hashPassword(recoveryCode),
  ]);
  const user = db
    .insert(users)
    .values({
      username: normaliseUsername(rawUsername),
      passwordHash,
      recoveryCodeHash,
    })
    .returning()
    .get();
  return { user, recoveryCode };
}

export function findUser(rawUsername: string): User | undefined {
  return db
    .select()
    .from(users)
    .where(eq(users.username, normaliseUsername(rawUsername)))
    .get();
}

const THROTTLE_WINDOW_MINUTES = 15;
const THROTTLE_MAX_FAILURES = 10;

export function isThrottled(rawUsername: string): boolean {
  const row = db
    .select({ failures: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.username, normaliseUsername(rawUsername)),
        eq(loginAttempts.succeeded, false),
        gt(
          loginAttempts.attemptedAt,
          sql`datetime('now', ${`-${THROTTLE_WINDOW_MINUTES} minutes`})`,
        ),
      ),
    )
    .get();
  return (row?.failures ?? 0) >= THROTTLE_MAX_FAILURES;
}

function recordAttempt(rawUsername: string, succeeded: boolean): void {
  db.insert(loginAttempts)
    .values({ username: normaliseUsername(rawUsername), succeeded })
    .run();
}

// A password verify against a throwaway hash, so a missing username costs the
// same wall-clock time as a wrong password and can't be probed for existence.
// Built on first use rather than at import: 16MB and ~100ms is a poor thing to
// spend at every server boot when most boots never see a bad username.
let decoyHash: Promise<string> | null = null;
function getDecoyHash(): Promise<string> {
  decoyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return decoyHash;
}

export async function authenticate(
  rawUsername: string,
  password: string,
): Promise<User | null> {
  if (isThrottled(rawUsername)) return null;
  const user = findUser(rawUsername);
  if (!user) {
    await verifyPassword(password, await getDecoyHash());
    recordAttempt(rawUsername, false);
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  recordAttempt(rawUsername, ok);
  return ok ? user : null;
}

export function startSession(userId: number, cookies: AstroCookies, url: URL) {
  const token = randomBytes(32).toString("base64url");
  db.insert(sessions)
    .values({
      tokenHash: hashToken(token),
      userId,
      expiresAt: sqliteDateTime(
        new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
      ),
    })
    .run();
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function currentUser(cookies: AstroCookies): User | null {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, sql`datetime('now')`),
      ),
    )
    .get();
  return row?.user ?? null;
}

export function endSession(cookies: AstroCookies): void {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).run();
  }
  cookies.delete(SESSION_COOKIE, { path: "/" });
}
