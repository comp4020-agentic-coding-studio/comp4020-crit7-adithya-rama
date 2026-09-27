CREATE TABLE `catalogue_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`release` text NOT NULL,
	`year` integer NOT NULL,
	`kind` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`release`) REFERENCES `catalogue_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `catalogue_search_idx` ON `catalogue_entries` (`year`,`kind`,`code`);--> statement-breakpoint
CREATE TABLE `change_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`plan_id` text,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `history_owner_idx` ON `change_history` (`user_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`program` text NOT NULL,
	`cohort` integer NOT NULL,
	`specialisation` text DEFAULT '' NOT NULL,
	`load` integer DEFAULT 24 NOT NULL,
	`student_type` text DEFAULT 'domestic' NOT NULL,
	`release` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`release`) REFERENCES `catalogue_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plans_owner_idx` ON `plans` (`user_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`records` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `catalogue_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`imported_at` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `selections` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`code` text NOT NULL,
	`units` integer NOT NULL,
	`year` integer NOT NULL,
	`session` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `selection_attempt_unique` ON `selections` (`plan_id`,`code`,`year`,`session`);