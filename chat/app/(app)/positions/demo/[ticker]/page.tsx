import { notFound } from "next/navigation";
import { PositionDossier } from "@/components/position-dossier";
import { getDemoPositionRecord } from "@/lib/demo/book";
import {
  relatedArticlesFor,
  type PositionDetail,
} from "@/lib/portfolio/position-detail";
import { derivePriceMove } from "@/lib/portfolio/price-move";

export const dynamic = "force-dynamic";

export default async function DemoPositionPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const asOf = new Date().toISOString().slice(0, 10);
  const record = getDemoPositionRecord(ticker, asOf);
  if (!record) notFound();

  const detail: PositionDetail = {
    ...record,
    priceMove: derivePriceMove(record.trades),
    relatedArticles: await relatedArticlesFor(record.position.ticker),
  };

  return <PositionDossier detail={detail} backHref="/portfolio/demo" />;
}
