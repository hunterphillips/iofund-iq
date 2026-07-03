import { SparkleGlyph } from "@/components/sparkle-glyph";

/**
 * Fabricated, live-rendered product mock for the landing page. Everything here
 * is invented sample data — fictional tickers, a made-up answer, a made-up
 * allocation. No real I/O Fund content appears. Labeled "illustrative" so it
 * reads as a demo of the interface, not a redistribution of paid research.
 */

// Invented allocation for the donut (sums to 100). Colors reuse the app's
// category swatch tokens so the mock looks native.
const SLICES = [
  { label: "Accelerators", pct: 34, color: "var(--color-cat-accelerators)" },
  { label: "Networking", pct: 22, color: "var(--color-cat-networking)" },
  { label: "Energy", pct: 18, color: "var(--color-cat-energy)" },
  { label: "Memory", pct: 14, color: "var(--color-cat-memory)" },
  { label: "Software", pct: 12, color: "var(--color-cat-software)" },
];

function donutGradient() {
  let acc = 0;
  const stops = SLICES.map((s) => {
    const start = (acc / 100) * 360;
    acc += s.pct;
    const end = (acc / 100) * 360;
    return `${s.color} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function ProductVignette({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* App-window chrome */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-cat-memory/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-cat-networking/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-cat-energy/70" />
          <span className="ml-3 font-mono text-[0.7rem] text-muted-deep">
            assistant
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
          {/* Chat column */}
          <div className="space-y-4 p-5">
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-bg/70 px-4 py-2.5 text-sm text-cream">
                What changed in the portfolio this month, and where am I
                underweight?
              </p>
            </div>
            <div className="flex gap-2.5">
              <SparkleGlyph className="mt-1 h-4 w-4 shrink-0 text-orange" />
              <div className="max-w-[88%] space-y-2 text-sm leading-relaxed text-cream">
                <p>
                  Two moves this month: a trim in{" "}
                  <span className="font-mono text-gold">ARVO</span> after the
                  run, and a new starter in{" "}
                  <span className="font-mono text-gold">NUMA</span> on the
                  power-buildout theme.
                </p>
                <p>
                  Against the current portfolio you're light on{" "}
                  <span className="text-cream">Energy</span> (18% there, ~4% for
                  you) and have no <span className="text-cream">Networking</span>{" "}
                  exposure.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="rounded-md border border-border bg-bg/50 px-2 py-1 font-mono text-[0.65rem] text-muted">
                    ◆ Trade log
                  </span>
                  <span className="rounded-md border border-border bg-bg/50 px-2 py-1 font-mono text-[0.65rem] text-muted">
                    ◆ Power & cooling note
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Portfolio column */}
          <div className="border-t border-border p-5 md:border-l md:border-t-0">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-deep">
              Current holdings
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="relative h-24 w-24 shrink-0 rounded-full"
                style={{ background: donutGradient() }}
                aria-hidden="true"
              >
                <div className="absolute inset-[22%] rounded-full bg-surface" />
              </div>
              <ul className="space-y-1.5">
                {SLICES.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center gap-2 text-xs text-muted"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-[3px]"
                      style={{ background: s.color }}
                    />
                    <span className="text-cream">{s.label}</span>
                    <span className="font-mono text-muted-deep">{s.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center font-mono text-[0.65rem] text-muted-deep">
        Illustrative interface. Sample data and fictional tickers, not live I/O
        Fund content.
      </p>
    </div>
  );
}
