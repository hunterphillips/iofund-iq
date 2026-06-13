/**
 * Vision extraction of brokerage holdings from a screenshot.
 *
 * Schema is intentionally narrow: ticker + shares. Per-share prices and
 * position values are NOT extracted — we look those up from Yahoo Finance
 * at API-route + chat-tool time. This sidesteps the column-interpretation
 * ambiguity in compact mobile brokerage views where a single $ column
 * could plausibly be price OR value.
 */
import { generateObject } from "ai";
import { z } from "zod";

export const HoldingSchema = z.object({
  ticker: z.string().min(1).max(10),
  shares: z.number().positive(),
});
export type Holding = z.infer<typeof HoldingSchema>;

export const ExtractionSchema = z.object({
  holdings: z.array(HoldingSchema),
  notes: z
    .string()
    .optional()
    .describe(
      "Freetext notes if the screenshot was ambiguous, partial, or contained items that were excluded (options, cash, money market, etc.).",
    ),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const EXTRACTION_PROMPT = `You are extracting equity holdings from a screenshot of a brokerage account screen.

For each holding row, return:
- ticker: the stock/ETF symbol shown, uppercased
- shares: the share count (decimals OK for fractional shares)

We will look up current prices ourselves — DO NOT extract any dollar amounts. Just ticker + shares.

Inclusion rules:
- Include common stocks and ETFs.
- For spot crypto direct holdings shown as Bitcoin/Ethereum/etc., use BTCUSD / ETHUSD / etc.
- For Bitcoin ETFs (BITB, IBIT, FBTC, etc.), use the actual ETF ticker.

Exclusion rules:
- Skip cash, money market funds, and pending settlements.
- Skip options contracts and futures.
- Skip totals/subtotals/summary rows.

If a row's ticker or share count is unreadable, omit the row and explain in 'notes'. Prefer accuracy over completeness — the user will manually correct anything missing.`;

export async function extractHoldings(
  imageBase64: string,
  mediaType: string,
): Promise<Extraction> {
  const { object } = await generateObject({
    model: "anthropic/claude-sonnet-4-6",
    schema: ExtractionSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "image", image: `data:${mediaType};base64,${imageBase64}` },
        ],
      },
    ],
  });

  return {
    holdings: object.holdings.map((h) => ({
      ticker: h.ticker.toUpperCase(),
      shares: h.shares,
    })),
    notes: object.notes,
  };
}
