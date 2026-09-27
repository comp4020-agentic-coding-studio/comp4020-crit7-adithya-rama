import { sql } from "drizzle-orm";
import {
  index,
  int,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
export const messages = sqliteTable("messages", {
  id: int().primaryKey({ autoIncrement: true }),
  body: text().notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Message = typeof messages.$inferSelect;

export const users = sqliteTable(
  "users",
  {
    id: int().primaryKey({ autoIncrement: true }),
    // stored already lower-cased; the unique index is what makes
    // "Adithya" and "adithya" the same account rather than two
    username: text().notNull(),
    passwordHash: text("password_hash").notNull(),
    recoveryCodeHash: text("recovery_code_hash"),
    recoveryCodeUsedAt: text("recovery_code_used_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex("users_username_unique").on(table.username)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    // sha256 of the cookie token, never the token itself: a leaked database
    // file then can't be replayed as a live session
    tokenHash: text("token_hash").primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: int().primaryKey({ autoIncrement: true }),
    username: text().notNull(),
    succeeded: int({ mode: "boolean" }).notNull(),
    attemptedAt: text("attempted_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("login_attempts_username_idx").on(
      table.username,
      table.attemptedAt,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
