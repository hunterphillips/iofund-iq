import { notFound } from "next/navigation";
import { PositionDossier } from "@/components/position-dossier";
import { getPositionDetail } from "@/lib/portfolio/position-detail";

export const dynamic = "force-dynamic";

export default async function PositionPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const detail = await getPositionDetail(ticker);
  if (!detail) notFound();

  return <PositionDossier detail={detail} />;
}
