// Placeholder — fleshed out in slice #5 (Fund Overview magazine landing).
export const dynamic = "force-dynamic";

export default function FundPage() {
  return <ComingSoon eyebrow="Fund" title="Overview lands in a later slice." />;
}

function ComingSoon({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-[1100px] mx-auto px-8 py-24">
      <div className="text-xs uppercase tracking-[0.18em] mb-3 text-orange">
        {eyebrow}
      </div>
      <h1 className="font-serif text-4xl leading-tight tracking-tight text-cream">
        {title}
      </h1>
    </div>
  );
}
