CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"pub_date" date,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"premium" boolean DEFAULT false NOT NULL,
	"category" text,
	"tickers" text[],
	"distilled_path" text,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "iof_credentials" (
	"user_id" text PRIMARY KEY NOT NULL,
	"encrypted_email" "bytea" NOT NULL,
	"encrypted_password" "bytea" NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" text PRIMARY KEY NOT NULL,
	"trade_date" date NOT NULL,
	"ticker" text NOT NULL,
	"action" text NOT NULL,
	"price" numeric(18, 4),
	"note" text,
	"analyst" text,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "articles_pub_date_idx" ON "articles" USING btree ("pub_date");--> statement-breakpoint
CREATE INDEX "trades_ticker_idx" ON "trades" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "trades_date_idx" ON "trades" USING btree ("trade_date");