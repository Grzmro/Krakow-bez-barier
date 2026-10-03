ALTER TABLE "outages" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outages" ADD COLUMN "removed_by" text;--> statement-breakpoint
ALTER TABLE "outages" ADD COLUMN "removal_ends_at" timestamp with time zone;