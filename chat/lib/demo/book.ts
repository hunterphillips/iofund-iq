import type {
  CategoryWeight,
  IofPosition,
  IofTrade,
} from "@/lib/portfolio/iof-book";
import type { IofBookEntry } from "@/lib/portfolio/gap-math";

interface DemoPositionSeed {
  ticker: string;
  company: string;
  category: string;
  weight: string | null;
  status: "held" | "closed";
}

type TradeSeed = readonly [
  offsetDays: number,
  action: "BUY" | "SELL",
  note: string,
  price: number,
];

const HELD_POSITIONS: DemoPositionSeed[] = [
  ["NVDA", "NVIDIA", "AI Accelerators", "12.0"],
  ["AVGO", "Broadcom", "AI Semis", "8.0"],
  ["MSFT", "Microsoft", "AI Software", "7.0"],
  ["TSM", "Taiwan Semiconductor", "AI Semis", "6.5"],
  ["AMD", "Advanced Micro Devices", "AI Accelerators", "6.0"],
  ["GOOG", "Alphabet", "AI Software", "6.0"],
  ["ALAB", "Astera Labs", "AI Networking", "5.5"],
  ["MU", "Micron Technology", "AI Memory", "5.0"],
  ["COHR", "Coherent", "AI Networking", "4.5"],
  ["GEV", "GE Vernova", "AI Energy", "4.5"],
  ["PLTR", "Palantir Technologies", "AI Software", "4.5"],
  ["LITE", "Lumentum Holdings", "AI Networking", "4.0"],
  ["ANET", "Arista Networks", "AI Networking", "3.5"],
  ["COIN", "Coinbase", "Cryptocurrency", "3.5"],
  ["GLW", "Corning", "AI Networking", "3.5"],
  ["MRVL", "Marvell Technology", "AI Semis", "3.5"],
  ["VST", "Vistra", "AI Energy", "3.5"],
  ["HOOD", "Robinhood Markets", "Cryptocurrency", "3.0"],
  ["MTSI", "MACOM Technology", "AI Networking", "3.0"],
  ["SITM", "SiTime", "AI Semis", "3.0"],
].map(([ticker, company, category, weight]) => ({
  ticker,
  company,
  category,
  weight,
  status: "held" as const,
}));

const CLOSED_POSITIONS: DemoPositionSeed[] = [
  { ticker: "SNOW", company: "Snowflake", category: "AI Software", weight: null, status: "closed" },
  { ticker: "DDOG", company: "Datadog", category: "AI Software", weight: null, status: "closed" },
];

const POSITION_SEEDS = [...HELD_POSITIONS, ...CLOSED_POSITIONS];

const TRADE_HISTORIES: Record<string, readonly TradeSeed[]> = {
  NVDA: [[1284, "BUY", "Started 3%", 45.20], [950, "BUY", "1% Add", 49.30], [620, "BUY", "1% Add", 87.10], [305, "SELL", "Trim 1%", 142.60], [2, "BUY", "1% Add", 205.40]],
  AVGO: [[1228, "BUY", "Started 2%", 62.40], [700, "BUY", "1% Add", 131.20], [35, "BUY", "0.5% Add", 388.90]],
  MSFT: [[1243, "BUY", "Started 2%", 249.00], [78, "BUY", "0.5% Add", 512.30]],
  TSM: [[1130, "BUY", "Started 2%", 92.50], [63, "BUY", "1% Add", 244.80]],
  AMD: [[1170, "BUY", "Started 2%", 89.40], [410, "BUY", "1% Add", 138.75]],
  GOOG: [[1188, "BUY", "Started 2%", 104.60], [110, "SELL", "Trim 1%", 201.50]],
  ALAB: [[840, "BUY", "Started 2%", 68.90], [95, "BUY", "2% Add", 151.70]],
  MU: [[900, "BUY", "Started 2%", 71.30], [9, "BUY", "0.5% Add", 138.25]],
  COHR: [[705, "BUY", "Started 2%", 224.10], [24, "BUY", "1% Add", 402.10]],
  GEV: [[755, "BUY", "Started 2%", 341.00], [41, "SELL", "Trim 1.5%", 812.40]],
  PLTR: [[893, "BUY", "Started 2%", 24.85], [460, "BUY", "1% Add", 63.40], [5, "SELL", "Trim 2%", 168.00]],
  LITE: [[620, "BUY", "Started 2%", 418.00], [48, "BUY", "1% Add", 861.00]],
  ANET: [[13, "BUY", "Started 2%", 122.60], [6, "BUY", "1.5% Add", 126.30]],
  COIN: [[650, "BUY", "Started 2%", 208.00], [150, "BUY", "1% Add", 341.20]],
  GLW: [[480, "BUY", "Started 2%", 118.00], [168, "BUY", "1% Add", 178.40]],
  MRVL: [[672, "BUY", "Started 2%", 61.20], [70, "SELL", "Trim half", 71.20]],
  VST: [[593, "BUY", "Started 2%", 96.40], [18, "SELL", "Trim 1%", 158.30]],
  HOOD: [[425, "BUY", "Started 1.5%", 66.20], [55, "BUY", "1.5% Add", 118.60]],
  MTSI: [[376, "BUY", "Started 1.5%", 214.00], [190, "BUY", "0.5% Add", 289.50]],
  SITM: [[158, "BUY", "Started 1%", 571.00], [128, "BUY", "0.5% Add", 601.30]],
  SNOW: [[810, "BUY", "Started 2%", 158.30], [340, "BUY", "0.5% Add", 171.90], [27, "SELL", "Closed", 149.75]],
  DDOG: [[505, "BUY", "Started 1.5%", 122.00], [88, "SELL", "Stop hit", 98.10]],
};

function dateBefore(asOf: string, offsetDays: number): string {
  const date = new Date(`${asOf}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

function materializeTrades(ticker: string, asOf: string): IofTrade[] {
  let id = 0;
  for (const key of Object.keys(TRADE_HISTORIES)) {
    if (key === ticker) break;
    id += TRADE_HISTORIES[key].length;
  }
  return TRADE_HISTORIES[ticker].map(([offset, action, note, price], index) => ({
    id: `demo:${id + index + 1}`,
    tradeDate: dateBefore(asOf, offset),
    ticker,
    action,
    price: price.toFixed(2),
    note,
    analyst: null,
  }));
}

function materializePosition(seed: DemoPositionSeed, asOf: string): IofPosition {
  const trades = materializeTrades(seed.ticker, asOf);
  const first = trades[0];
  const last = trades[trades.length - 1];
  return {
    ticker: seed.ticker,
    company: seed.company,
    category: seed.category,
    status: seed.status,
    baselineWeightPct: seed.weight,
    firstEntryDate: first.tradeDate,
    lastActionDate: last.tradeDate,
    lastActionType: last.action,
  };
}

export const DEMO_BOOK_ENTRIES: IofBookEntry[] = HELD_POSITIONS.map((position) => ({
  ticker: position.ticker,
  company: position.company,
  category: position.category,
  iofWeight: Number(position.weight),
}));

export function getDemoBook(asOf: string): {
  positions: IofPosition[];
  trades: IofTrade[];
  categoryBreakdown: CategoryWeight[];
} {
  const positions = HELD_POSITIONS.map((seed) => materializePosition(seed, asOf)).sort(
    (a, b) => Number(b.baselineWeightPct) - Number(a.baselineWeightPct),
  );
  const trades = POSITION_SEEDS.flatMap((seed) => materializeTrades(seed.ticker, asOf))
    .filter((trade) => trade.tradeDate >= dateBefore(asOf, 180) && trade.tradeDate <= asOf)
    .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));

  const weights = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const position of positions) {
    if (!position.category) continue;
    weights.set(position.category, (weights.get(position.category) ?? 0) + Number(position.baselineWeightPct));
    counts.set(position.category, (counts.get(position.category) ?? 0) + 1);
  }
  const totalWeight = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  const categoryBreakdown = [...weights.entries()]
    .map(([category, weight]) => ({
      category,
      weight,
      sharePct: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
      count: counts.get(category) ?? 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  return { positions, trades, categoryBreakdown };
}

export function getDemoPositionRecord(
  ticker: string,
  asOf: string,
): { position: IofPosition; trades: IofTrade[] } | null {
  const symbol = ticker.toUpperCase();
  const seed = POSITION_SEEDS.find((candidate) => candidate.ticker === symbol);
  if (!seed) return null;
  return {
    position: materializePosition(seed, asOf),
    trades: materializeTrades(symbol, asOf),
  };
}
