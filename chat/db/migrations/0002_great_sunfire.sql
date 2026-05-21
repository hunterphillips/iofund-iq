CREATE TABLE "positions" (
	"ticker" text PRIMARY KEY NOT NULL,
	"company" text,
	"category" text,
	"status" text NOT NULL,
	"baseline_weight_pct" numeric(5, 2),
	"first_entry_date" date,
	"last_action_date" date,
	"last_action_type" text,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "positions_status_idx" ON "positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "positions_category_idx" ON "positions" USING btree ("category");