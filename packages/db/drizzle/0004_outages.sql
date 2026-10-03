CREATE TABLE "outage_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outage_id" uuid NOT NULL,
	"vote" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"equipment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outage_votes" ADD CONSTRAINT "outage_votes_outage_id_outages_id_fk" FOREIGN KEY ("outage_id") REFERENCES "public"."outages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outages" ADD CONSTRAINT "outages_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outage_votes_outage_idx" ON "outage_votes" USING btree ("outage_id");--> statement-breakpoint
CREATE INDEX "outages_place_idx" ON "outages" USING btree ("place_id","equipment","created_at");