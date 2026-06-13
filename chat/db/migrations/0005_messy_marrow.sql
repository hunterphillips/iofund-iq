CREATE TABLE "user_holdings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"holdings" jsonb NOT NULL,
	"source" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
