import {
  boolean,
  customType,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value as Buffer;
  },
});

export const iofCredentials = pgTable("iof_credentials", {
  userId: text("user_id").primaryKey(),
  encryptedEmail: bytea("encrypted_email").notNull(),
  encryptedPassword: bytea("encrypted_password").notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trades = pgTable(
  "trades",
  {
    id: text("id").primaryKey(),
    tradeDate: date("trade_date").notNull(),
    ticker: text("ticker").notNull(),
    action: text("action").notNull(),
    price: numeric("price", { precision: 18, scale: 4 }),
    note: text("note"),
    analyst: text("analyst"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("trades_ticker_idx").on(t.ticker),
    index("trades_date_idx").on(t.tradeDate),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull().unique(),
    pubDate: date("pub_date"),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    premium: boolean("premium").notNull().default(false),
    category: text("category"),
    tickers: text("tickers").array(),
    distilledPath: text("distilled_path"),
    body: text("body"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("articles_pub_date_idx").on(t.pubDate)],
);

export const positions = pgTable(
  "positions",
  {
    ticker: text("ticker").primaryKey(),
    company: text("company"),
    category: text("category"),
    status: text("status").notNull(),
    baselineWeightPct: numeric("baseline_weight_pct", { precision: 5, scale: 2 }),
    firstEntryDate: date("first_entry_date"),
    lastActionDate: date("last_action_date"),
    lastActionType: text("last_action_type"),
    source: text("source").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("positions_status_idx").on(t.status),
    index("positions_category_idx").on(t.category),
  ],
);

export const userHoldings = pgTable("user_holdings", {
  userId: text("user_id").primaryKey(),
  holdings: jsonb("holdings").notNull(),
  source: text("source").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
