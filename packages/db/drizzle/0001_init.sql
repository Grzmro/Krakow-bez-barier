CREATE TABLE "confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"fact_id" uuid NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"subject" text DEFAULT 'place' NOT NULL,
	"attribute" text NOT NULL,
	"value" jsonb NOT NULL,
	"unit" text,
	"source_id" text NOT NULL,
	"source_record_ref" text DEFAULT '' NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"observed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"reliability" text NOT NULL,
	"evidence" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"records_seen" integer DEFAULT 0 NOT NULL,
	"records_written" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_ref" text,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"location" geometry(Point,4326) NOT NULL,
	"street" text,
	"house_number" text,
	"postal_code" text,
	"city" text DEFAULT 'Kraków' NOT NULL,
	"phone" text,
	"website" text,
	"email" text,
	"entrance_hint" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_external_ref_unique" UNIQUE("external_ref")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"attribute" text NOT NULL,
	"value" jsonb NOT NULL,
	"comment" text,
	"photo_url" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"license" text NOT NULL,
	"terms_url" text,
	"attribution" text,
	"url" text,
	"refresh_interval" text,
	"base_reliability" text NOT NULL,
	"refresh_status" text DEFAULT 'never' NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"status_note" text,
	"is_sample" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "confirmations_fact_idx" ON "confirmations" USING btree ("fact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facts_active_unique" ON "facts" USING btree ("source_id","source_record_ref","subject","attribute") WHERE "facts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "facts_place_idx" ON "facts" USING btree ("place_id","attribute");--> statement-breakpoint
CREATE INDEX "ingestion_runs_source_idx" ON "ingestion_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE INDEX "places_location_gist" ON "places" USING gist ("location");--> statement-breakpoint
CREATE INDEX "places_category_idx" ON "places" USING btree ("category");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");