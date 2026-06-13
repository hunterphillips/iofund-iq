CREATE TABLE "brokerage_credentials" (
	"user_id" text NOT NULL,
	"broker" text NOT NULL,
	"encrypted_access_token" "bytea" NOT NULL,
	"encrypted_refresh_token" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"device_token" text NOT NULL,
	"broker_user_id" text,
	"last_synced_at" timestamp with time zone,
	"last_synced_positions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brokerage_credentials_user_id_broker_pk" PRIMARY KEY("user_id","broker")
);
--> statement-breakpoint
CREATE INDEX "brokerage_credentials_user_idx" ON "brokerage_credentials" USING btree ("user_id");