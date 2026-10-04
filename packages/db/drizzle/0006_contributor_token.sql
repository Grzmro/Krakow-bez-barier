ALTER TABLE "confirmations" ADD COLUMN "contributor_hash" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "contributor_hash" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "confirmations_contributor_idx" ON "confirmations" USING btree ("contributor_hash","place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_pending_contributor_unique" ON "reports" USING btree ("contributor_hash","place_id","attribute") WHERE "reports"."contributor_hash" is not null and "reports"."withdrawn_at" is null and "reports"."status" in ('new', 'needs_info');