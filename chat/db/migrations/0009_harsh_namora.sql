CREATE TABLE "broker_holdings" (
	"user_id" text NOT NULL,
	"ticker" text NOT NULL,
	"shares" numeric(18, 6) NOT NULL,
	"source" text DEFAULT 'robinhood' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broker_holdings_user_id_ticker_pk" PRIMARY KEY("user_id","ticker")
);
--> statement-breakpoint
CREATE TABLE "robinhood_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"encrypted_access_token" "bytea" NOT NULL,
	"encrypted_refresh_token" "bytea" NOT NULL,
	"account_number" text NOT NULL,
	"rhs_account_number" text,
	"access_token_expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
