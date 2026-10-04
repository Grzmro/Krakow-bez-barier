CREATE TABLE "source_outage_simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"started_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"stopped_at" timestamp with time zone,
	"stopped_by" text
);
--> statement-breakpoint
ALTER TABLE "source_outage_simulations" ADD CONSTRAINT "source_outage_simulations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_outage_simulations_active_idx" ON "source_outage_simulations" USING btree ("ends_at","source_id");