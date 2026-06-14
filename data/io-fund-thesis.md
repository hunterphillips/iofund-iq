---
purpose: I/O Fund's current investment thesis, per-ticker conviction history, theme evolution, and observed decision-reasoning patterns. Distilled from quarterly "Top 15" reports.
load_priority: high
audience: agent
last_distilled: 2026-05-20
quarters_covered: [Q4-2025, Q1-2026, Q2-2026]
sources:
  - https://io-fund.com/premium/the-io-funds-top-15-ai-stocks-for-q4-2025  # Oct 28 2025
  - https://io-fund.com/premium/the-io-funds-top-15-stocks-for-q1-2026     # Jan 29 2026
  - https://io-fund.com/premium/the-io-funds-top-15-stocks-for-q2-2026     # Apr 21 2026
companion_docs:
  - io-fund-strategy.md       # alert decoding + sizing rules
  - iofund-trades.csv         # raw trade log
---

# I/O Fund — Thesis State, Evolution & Reasoning Patterns

This doc is the **why** layer behind IOF's trades. For *what* they hold see `iofund-trades.csv`. For *how* they trade (alert decoding, sizing, hedging) see `io-fund-strategy.md`.

---

## 1. Current Thesis State (Q2 2026, April 21, 2026)

### Active themes (priority order)

1. **Accelerators shift from raw compute → unit economics.** Tokens/watt, $/token now the KPI. GB300 = 50× perf/watt vs H200. Rubin = 10× inference perf/watt vs Blackwell.
2. **Cooling re-emerges as load-bearing.** Rubin (180–230 kW/rack) can't be air-cooled. Nvidia moving to warm-water (45°C) for +10% GPU density.
3. **Memory pricing power vs cyclical doubts.** DRAM up >20× YoY. Kioxia + others sold out of 2026 NAND. Author's call: now more secular than cyclical.
4. **Networking optical shift.** Copper → SiPho → CPO. CPO cuts power 65% (AVGO) / 3.5× (NVDA).
5. **AI Monetization supercycle taking off.** OpenAI $25B+ ARR, Anthropic >$30B ARR (+$21B since end-2025). MCP adoption (97M downloads) = agentic AI inflection.
6. **Energy = supreme bottleneck.** McKinsey: 25–33% of new generation from BTM by 2030. Behind-the-meter, fuel cells, gas turbines, miners, SMRs.

### Headline move
- **Closed Nvidia.** Bold call given Nvidia's centrality. Reasons: (a) confirmed Rubin delay tied to HBM4 validation, (b) custom silicon gaining inference share, (c) CUDA moat erodes in inference (vLLM, SGLang, ONNX, TensorRT-LLM less defensible than CUDA training stack).

### Current picks (held as of Q2 2026, updated for post-Q2 trade activity)

| Category | Ticker | One-line thesis | Risk |
|---|---|---|---|
| Accelerators | **AVGO** | Top accelerator pick. AI rev "in excess of $100B in 2027" + $50B networking. ~30% QoQ sustainable 7–8 qtrs | Debt $66B; Google diversifying with MediaTek |
| Accelerators | **ARM** | AGI CPU for agentic orchestration. New entrant. CPU cores 30M→120M per GW | Premium valuation (29 fwd PS); IP→merchant transition risk |
| Accelerators | **AMD** | >60% DC annual growth 3–5 yrs (mgmt). MI400/Helios H2 2026 catalyst. ~50% more memory than Rubin | CoWoS allocation only ~7% of 2026 supply vs >50% NVDA |
| Accelerators | **TSM** | CoWoS is the linchpin for all accelerators | Geopolitical |
| Memory | **MU** | "Doors blown off." FQ3 guide: rev $33.5B (+260%), GM 81%, OM 76% | Cyclical-vs-secular debate |
| Memory | **SNDK** | NAND tightening. Q3 guide ~200% above consensus | New name in list; less coverage |
| Networking | **LITE** | Capacity-constrained on EMLs. Pricing power. CW-laser + SiPho alt-route winner | InP supply |
| Networking | **AAOI** | IOF early call; +~300% YTD / +650% from low entry | High momentum, less fundamentals visibility |
| Networking | **COHR** | InP capacity doubling → CY26 inflection | Debt leverage |
| Networking | **ALAB** | Scorpio momentum continues. Bouncing off lows | Tough comps |
| Networking | **VRT** | Facility-level cooling for Rubin's warm-water design. New entrant | Newer position, limited trade history |
| Big Tech | **META** | Tied for best Mag 7. AI rec models tailwinding ad ROI | Capex spend |
| Big Tech | **GOOG** | Tied for first Mag 7. TPU/Ironwood. Gemini diffusion +300% partner-AI rev YoY | Antitrust |
| Software | **PLTR** | Commercial surges (Q4 GAAP EPS +700%). Cash $7.18B, zero debt. **~50% position trimmed 2026-05-18 @ $133.51; half position remains.** | "Software stocks will be tested" — IOF cautious on category |
| Software | **NET** | Edge inference positioning unique. Timing the open question | Not GAAP profitable after 16 yrs |
| Energy | **BE** | Time-to-power thesis. 2GW capacity by Dec 2026 → ~4× 2025 rev. **~1,300% from initial entries ($16.64–$17.04, April 2025).** | Premium valuation (13.8 fwd PS) |
| Energy | **GEV** | Order book sold out through 2028. Gas-turbine supply locked through 2030 | Slower growth profile |

### Closed / removed in Q2 2026
- **NVDA** — closed (see headline move)
- **APP** — removed/de-emphasized from list (was held Q4-Q1)
- **CRWV** — not in Q2 list (held in Q4-Q1 with outsized-risk caveat)

### Closed after Q2 2026 (post-report trade activity)
- **RDDT** — fully closed 2026-05-18 @ $158.85. Was listed as ✓ held ("scarce asset" / human-data farm thesis). Closure logged in trade log; thesis doc updated accordingly.

### Thematic but not held (utilities + miners)
- **Talen / Constellation / Vistra** — discussed thematically given PJM auction surge (clearing prices +11× over 2 yrs); Talen = purest PJM play.
- **Bitcoin miners** — case made for retrofit-to-AI-DC plays; played via Discovery tier with the "stay close to hyperscaler deals" creditworthiness criterion.

---

## 2. Per-Ticker Timeline (across covered quarters)

> Legend: ✓ held with thesis | ↑ promoted / increased emphasis | ↓ de-emphasized | ✗ dropped / closed | — not in list

| Ticker | Q4 2025 | Q1 2026 | Q2 2026 | Net trajectory |
|---|---|---|---|---|
| **NVDA** | ✓ #1 accelerator | ✓ "greater emphasis on memory" | ✗ **closed** | Closed at $209.67 (2026-04-27) on Rubin delay + custom silicon competition |
| **AVGO** | ✓ #2 accelerator | ✓ Ethernet + custom silicon | ↑ **#1 accelerator** | Promoted as NVDA exited |
| **AMD** | ✓ #3 accelerator | ✓ "element of surprise" | ✓ "underestimated/misunderstood" | Consistent hold; thesis around H2 2026 MI400 |
| **TSM** | ✓ #5 (5/10 fundamentals) | ✓ multi-year visibility | ✓ CoWoS linchpin | Consistent hold; framing shifted to capacity bottleneck |
| **MU** | ✓ #4 accelerator | ↑ memory crown from compute | ↑ "doors blown off" | Promoted each quarter; secular re-rating ongoing |
| **SNDK** | — | + Added (market leader 2026) | ✓ "thing in motion" | New entrant Q1; held |
| **ALAB** | ✓ tied #1 networking | ✓ Scorpio-X | ✓ bouncing off lows | Consistent hold across all 3 |
| **CRDO** | ✓ tied #1 networking | ✗ **dropped** | — | Dropped on copper-to-optics shift (Rubin pushes optical) |
| **LITE** | ✓ #4 networking | ↑ EMLs power 400G/800G | ↑ capacity-constrained | Strongly promoted across quarters |
| **COHR** | — | + Added (InP capacity doubling) | ✓ slow and steady | New Q1; held |
| **AAOI** | — | — | + **Added** | New Q2 entrant after ~300% YTD move |
| **VRT** | — | — | + **Added** | New Q2 entrant on cooling thesis |
| **RDDT** | ✓ #1 software/data | ✓ contextual high-intent data | ✓ scarce asset → ✗ **closed 2026-05-18** | Fully closed @ $158.85; post-Q2 exit |
| **CRWV** | ✓ #2 software (thematic 11/10) | ✓ legacy IaaS wasn't built for AI | ✗ **removed from list** | Debt trajectory (D/C ratio ~12× projected for 2026) finally too much |
| **ORCL** | ✓ #3 software | ✗ **dropped** | — | Dropped Q1 |
| **APP** | ✓ #4 software | ✓ sentiment doesn't match fundamentals | ✗ **dropped/de-emphasized** | Held Q4-Q1, exit by Q2 |
| **NET** | ✓ #5 software | ✓ early but unique | ✓ timing main question | Consistent placeholder/speculation hold |
| **PLTR** | — | + Added (discipline vs conviction) | ✓ commercial surges → ↓ **~50% trimmed 2026-05-18** | Half position remains after trim @ $133.51 |
| **META** | — (honorable mention) | (honorable mention) | ✓ **added** (Mag 7) | Promoted from honorable mention to held |
| **GOOG** | — | — | + **Added** (Mag 7) | New Q2 entrant |
| **ARM** | — | — | + **Added** (AGI CPU) | New Q2 entrant |
| **BE** | ✓ #1 energy | ✓ time-to-power | ✓ +1,300% from entry | Consistent hold; capacity ramping into 2026-2027 |
| **GEV** | ✓ #2 energy | ✓ nat gas behemoth | ✓ held (order book to 2028) | Consistent hold |
| Bitcoin Miner | ✓ #3 energy (Discovery) | ✓ Discovery only | ✓ Discovery only | Gated to Discovery tier across all 3 |

> Cross-reference any of these against `iofund-trades.csv` for entry/exit prices and dates.

---

## 3. Theme Evolution (Q4 2025 → Q2 2026)

| Theme | Q4 2025 | Q1 2026 | Q2 2026 |
|---|---|---|---|
| **Networking** | #1 (Nvidia networking +46% QoQ) | #1 (Rubin shifts to optical) | Still load-bearing, now more about supplier turnover |
| **Energy** | #2 (15% US reserve margin vs 80% China) | ↑ Bigger bottleneck (utility timing gap to 2028-29) | ↑ Approaching dominant allocation |
| **Accelerators** | #3 (Big Tech capex $365B for 2025) | Capex raised to $583B for 2026 | Capex raised again to $600B; focus shifts to unit economics |
| **Inference** | Implicit in software section | NEW #3 explicit theme | Subsumed into "AI Monetization Supercycle" |
| **Memory** | Inside accelerators (MU/HBM) | NEW separate section (MU + SNDK) | Major section; pricing-power thesis |
| **Cooling** | Mentioned in passing | Minor mention | NEW: Re-elevated as Rubin's air-cooling becomes impossible |
| **CPU/orchestration** | — | — | NEW: ARM AGI CPU thesis (agentic AI shifts bottleneck) |
| **Bitcoin Miners** | #3 energy (gated) | Gated | Thematic discussion, less explicit pick |

**Cross-quarter pattern:** themes broaden each quarter rather than rotate. Picks rotate; themes accrete.

---

## 4. IOF Decision-Reasoning Patterns

Patterns observed across the three reports — useful for predicting what they'll do next.

### Entry / addition triggers
- **New product cycle inflection.** ALAB on Scorpio launch, VRT on Rubin cooling, ARM on AGI CPU.
- **Sector saturation about to break.** AVBO promoted as NVDA's CUDA moat erodes.
- **Counter-narrative pricing.** MU when memory still seen as cyclical. AAOI after the market wrote it off.
- **Capex / capacity sellout.** GEV (gas turbines sold out to 2028). MU (NAND sold out 2026).

### Exit / closure triggers
- **Thesis-specific structural shift.** CRDO dropped when Rubin pushes optics (AEC content erodes). NVDA closed when Rubin HBM4 delay + inference moat softens.
- **Valuation extreme + softer fundamentals.** APP de-emphasized after sentiment vs fundamentals gap closed.
- **Cash/debt collapse risk.** CRWV removed when 2026 D/C projected to 12×.
- **Macro re-rating done.** ORCL after RPO surge played out.

### Sizing tells (cross-reference with trade log notes)
- New entry typically <2% of portfolio.
- "Build into strength" pattern → multiple adds within weeks of first entry.
- "Trim into strength" pattern → single position >10% triggers discretionary trim.
- "X% trim" alerts during sector strength = risk management, NOT thesis break.

### What IOF "watches without owning"
Several names tracked across multiple quarters without entering. Pattern usually = valuation extremity + valid thesis. E.g. Palantir (held Q1+Q2 finally) was "watched without action" for some time. CRWV was the inverse — thematic 11/10 but cash/debt prevented full conviction.

### Macro reading
- **Capex revisions are the single most-cited signal.** Big Tech capex 2025: estimates $250B → $365B → $435B → re-rated upward each quarter. 2026: $583B → $600B in 3 months. IOF uses capex revisions as the upstream signal for hardware demand.
- **Cluster of buys = market-low call.** 22 buys Feb–April 2025 (9 on April 4 low). Watch for similar clustering in trade log for "Knox's bottom call" signal.

---

## 5. Discovery-Tier Picks (gated, listed for awareness)

These are referenced in Q4-Q2 reports but full details are behind a higher subscription tier. Names mentioned:

| Quarter | Tier-gated pick | What we know |
|---|---|---|
| Q4 2025 | Small-cap networking | +40% QoQ growth, 17% QoQ guide, capacity 8.5× this year + 2× by mid-2026 |
| Q4 2025 | Bitcoin miner #1 | ~325% YoY growth forecast with positive op margin |
| Q1 2026 | PJM auction stock | 13 GW capacity (1.9 GW hyperscaler-contracted); levered to PJM pricing |
| Q1 2026 | KV-cache memory beneficiary | Positioned for Nvidia's Inference Context Memory Storage platform |
| Q2 2026 | Long-haul networking supplier | Telecom-network specialty; IOF says NVDA/AVGO unlikely to compete |

Worth probing whether a Discovery upgrade is justified — these picks tend to be the highest-conviction speculative slots.

---

## 6. Notes for Future Agents

- **The trade log is the ground truth, this doc is the interpretation layer.** If a ticker appears here but the trade log shows it's been closed since, trust the log.
- **Themes accrete; picks rotate.** When evaluating whether IOF would buy a new name, check theme alignment first.
- **"Held" in Q2 2026 doesn't mean still held today.** This doc dates to April 21 2026. Always cross-reference against trade log for activity since.
- **CoreWeave + Nvidia exits are the loudest signals in this 3-quarter window** — note how IOF telegraphed both via thesis weakening across quarters before fully exiting. Watch for similar gradual thesis erosion as an exit-prediction pattern.
- **The "Discovery tier" picks are the speculation slots.** When you see thematic discussion without a held ticker (e.g., utilities, miners), the actionable name is gated.
