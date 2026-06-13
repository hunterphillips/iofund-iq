import { notFound } from "next/navigation";
import { readDigest } from "@/lib/fund/digests";
import { ReadingLayout } from "@/components/reading-layout";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ date: string }>;
}

export default async function DigestPage({ params }: Props) {
  const { date } = await params;
  const digest = readDigest(date);

  if (!digest) notFound();

  return (
    <ReadingLayout
      eyebrow="Weekly digest"
      title={`Week of ${digest.date}`}
      body={digest.body}
      backHref="/fund"
      backLabel="Fund"
    />
  );
}
