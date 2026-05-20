ALTER TABLE "articles" ADD COLUMN "body" text;
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "body_tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("body",  '')), 'B')
  ) STORED;
--> statement-breakpoint
CREATE INDEX "articles_body_tsv_idx" ON "articles" USING GIN ("body_tsv");
