---
purpose: I/O Fund's current investment thesis, per-ticker conviction history, theme evolution, and observed decision-reasoning patterns. Distilled from quarterly "Top 15" reports.
note: Agent-only doc read by the chat assistant via read_doc('thesis') and scanned for drift by scripts/digest_week.py. NOT shown on the website — the human-facing page reads io-fund-thesis.md.
load_priority: high
audience: agent
last_distilled: 2026-08-30
quarters_covered: [Q4-2025, Q1-2026, Q2-2026]
sources:
  - https://io-fund.com/premium/the-io-funds-top-15-ai-stocks-for-q4-2025  # Oct 28 2025
  - https://io-fund.com/premium/the-io-funds-top-15-stocks-for-q1-2026     # Jan 29 2026
  - https://io-fund.com/premium/the-io-funds-top-15-stocks-for-q2-2026     # Apr 21 2026
companion_docs:
  - io-fund-strategy.agent.md  # alert decoding + sizing rules (agent doc)
  - query_trades tool          # raw trade log (Postgres public.trades)
---

# I/O Fund — Thesis State, Evolution & Reasoning Patterns

This doc is the **why** layer behind IOF's trades. For *what* they hold, query the trade log via the `query_trades` tool. For *how* they trade (alert decoding, sizing, hedging) see `io-fund-strategy.md`.

---

## 1. Current Thesis State (Q2 2026, April 21, 2026)

### Active themes (priority order)

1. **Accelerators shift from raw compute → unit economics.** Tokens/watt, $/token now the KPI. GB300 = 50× perf/watt vs H200. Rubin = 10× inference perf/watt vs Blackwell.
2. **Cooling re-emerges as a hard constraint.** Rubin (180–230 kW/rack) can't be air-cooled. Nvidia moving to warm-water (45°C) for +10% GPU density.
3. **Memory pricing power vs cyclical doubts.** DRAM up >20× YoY. Kioxia + others sold out of 2026 NAND. Author's call: now more secular than cyclical.
4. **Networking optical shift.** Copper → SiPho → CPO. CPO cuts power 65% (AVGO) / 3.5× (NVDA).
5. **AI Monetization supercycle taking off.** OpenAI $25B+ ARR, Anthropic >$30B ARR (+$21B since end-2025). MCP adoption (97M downloads) = agentic AI inflection.
6. **Energy = supreme bottleneck.** McKinsey: 25–33% of new generation from BTM by 2030. Behind-the-meter, fuel cells, gas turbines, miners, SMRs.
7. **Token demand shattering forecasts = inference infra supercycle.** Token processing (clearest inference proxy) exceeding even heavily revised forecasts by 10–100×. Google tokens +330× over two years (May 2024→May 2026); Dell's 2028 estimate revised up 57× yet already exceeded; reasoning/agentic workloads (up to 15× more tokens/user, coding agents 1,000× more than code chats) are the driver. Tokens-per-watt is the defining upgrade metric (MS data-center net margins: ~58% Blackwell, ~78% Rubin, ~90% Feynman).
8. **Capex accelerates toward $1T; suppliers capture the flow-through.** 2026 hyperscaler capex guidance now $732.5B (+79% YoY), tracking ~$1T in 2027 (Goldman models $1.01T). Semiconductor EPS growth (97% projected 2026) runs ~6× hyperscaler EPS growth; memory + networking grow faster than capex itself. IOF's position: own the suppliers receiving capex, not the hyperscalers spending it.

### Headline moves
- **Closed Nvidia (2026-04-27 @ $209.67).** Bold call given Nvidia's centrality. Reasons: (a) confirmed Rubin delay tied to HBM4 validation, (b) custom silicon gaining inference share, (c) CUDA moat erodes in inference (vLLM, SGLang, ONNX, TensorRT-LLM less defensible than CUDA training stack). A ~0.2% starter re-entry shows in the 2026-08-30 portfolio table.
- **Exited Big Tech entirely, then the top accelerator pick (June–July 2026).** GOOGL closed 6/25, META closed 7/29 (after a brief 7/27 re-buy), and AVGO — the post-Nvidia #1 pick — closed 7/27. META's exit reasoning: revenue growth decelerating (28% YoY, down from 33%), GAAP operating margin down 12 pts, FCF down 91% YoY (capex consumed 97.5% of operating cash flow), and the incoherent Meta Compute venture (selling compute while leasing third-party capacity). Consistent with theme 8: hold the suppliers receiving capex, not the spenders.
- **Rotated into memory/storage/optics suppliers (late July 2026).** Single-day 7/27 spree: STX +3%, WDC +3%, SIMO/AAOI/LITE adds, CRDO add; SNDK add 7/28. Memory + storage now ~35% of the book.

### Current picks (per the 2026-08-30 portfolio table; weights are baseline allocation %)

| Category | Ticker | Wt | One-line thesis | Risk |
|---|---|---|---|---|
| Networking | **LITE** | 11.5 | Capacity-constrained on EMLs. Pricing power. CW-laser + SiPho alt-route winner. Added into July weakness | InP supply |
| Networking | **AAOI** | 10.1 | IOF early call; +~800% since November 2025 entry. Repeatedly added on dips (May–Jul) | High momentum, less fundamentals visibility |
| Networking | **SITM** | 9.5 | Precision-timing chips for AI clusters; built 3%→9.5% across May–Jul buys | Thesis thinly covered in distilled corpus |
| Memory | **SNDK** | 8.9 | NAND tightening; inference to drive demand + visibility for years (FQ4 article) | Volatile; trimmed 5% in June, re-added July |
| Memory | **SIMO** | 7.4 | NAND-controller side of the memory thesis; built across four buys May–Jul | Thesis thinly covered in distilled corpus |
| Networking | **CRDO** | 5.2 | Re-entered 7/24 (4%) + 7/27 add — reversal of the Q1 drop; AEC/connectivity demand back in favor | Re-entry thesis not yet articulated in articles |
| Software | **NET** | 5.2 | Edge inference positioning unique. 5% buy 7/27 rebuilt the position | Not GAAP profitable after 16 yrs |
| Memory | **MTSI** | 4.5 | RF/optical semis (MACOM); diversified AI optics drove +40% QoQ data-center growth (FQ3 article). PDF categorizes under Memory | Trade-driven entry 6/25 |
| Memory | **MU** | 4.5 | "Doors blown off." Secular re-rating thesis intact; trimmed three times into strength May–Jul | Cyclical-vs-secular debate |
| Energy | **GEV** | 4.5 | Order book sold out through 2028. Gas-turbine supply locked through 2030. 7% trim 7/22 was risk management | Slower growth profile |
| Networking | **MXL** | 4.4 | Built 2%→~4.4% across three buys May–Jul; optical/connectivity theme | Thesis thinly covered in distilled corpus |
| Accelerators | **AMD** | 4.4 | >60% DC annual growth 3–5 yrs (mgmt). MI400/Helios H2 2026 catalyst | CoWoS allocation only ~7% of 2026 supply |
| Networking | **COHR** | 4.3 | InP capacity doubling; $3B quarterly AI-optics revenue in sight (Q4 article) | Debt leverage |
| Energy | **BE** | 4.3 | Time-to-power thesis. ~1,300% from initial entries (Apr 2025); trimmed twice into strength | Premium valuation |
| Memory | **STX** | 4.0 | HDD/storage leg of the late-July memory rotation (3% buy 7/27) | Thesis not yet covered in distilled corpus |
| Memory | **WDC** | 3.9 | HDD/storage leg of the late-July memory rotation (3% buy 7/27) | Thesis not yet covered in distilled corpus |
| Networking | **ALAB** | 3.2 | Closed 7/24 @ $293.90, re-entered 8/6 @ $335.02 (4%) — quick round trip back in on Scorpio momentum | Tough comps; churny trade history |
| Accelerators | **NVDA** | 0.2 | Starter re-entry per the 2026-08-30 portfolio table (no alert in trade log) | Position too small to signal conviction yet |

### Closed / removed in Q2 2026
- **NVDA** — closed (see headline moves; tiny starter re-entry as of late Aug)
- **APP** — removed/de-emphasized from list (was held Q4-Q1)
- **CRWV** — not in Q2 list (held in Q4-Q1 with outsized-risk caveat)

### Closed after Q2 2026 (post-report trade activity)
- **RDDT** — fully closed 2026-05-18 @ $158.85. Was listed as ✓ held ("scarce asset" / human-data farm thesis).
- **BTCUSD / LINKUSD** — crypto sleeve closed 2026-05-27.
- **META** — closed 2026-05-29 @ $627.97; re-bought 2% 2026-07-27 @ $597.84; closed again 2026-07-29 @ $543.36 after the Q2 print (see headline moves).
- **INOD** — 2% momentum buy 6/9 @ $90.58, closed 6/15 @ $105.01. Six-day round trip.
- **ARM** — 4% momentum buy 6/9 @ $300.79 (note: "momo"), closed 6/25 @ $347.09. The Q2 AGI-CPU thesis (CPU:GPU ratio toward 1:1, 8×–10× core/GW, $15B FY31 target) was extended in a June article, but the position was traded, not held.
- **GOOGL** — fully closed 2026-06-25 @ $341.22. Was Mag 7 / TPU-Ironwood / Gemini thesis.
- **PLTR** — ~50% trimmed 2026-05-18 @ $133.51; remaining half closed 2026-06-25 @ $107.44.
- **NEE** — closed 2026-07-07 @ $88.78 (energy sleeve consolidation into BE/GEV).
- **GLW** — 3% add 6/25 @ $222.35, closed 7/24. Short-lived optics position.
- **AVGO** — fully closed 2026-07-27 @ $380.66. Had been the post-Nvidia #1 accelerator pick; 3–4% trims in May/June preceded the exit.
- **SMH hedge** — covered 2026-07-28 @ $526.52.
- **DDOG** — 5% buy 7/24 @ $245.26, closed 8/6 @ $232.91. Two-week round trip.
- **TSM / VRT** — listed as Q2 picks but absent from the tracked portfolio table; treat as exited (no closure alert in the trade log).

### Thematic but not held (utilities + miners)
- **Talen / Constellation / Vistra** — discussed thematically given PJM auction surge (clearing prices +11× over 2 yrs); Talen = purest PJM play.
- **Bitcoin miners** — case made for retrofit-to-AI-DC plays; played via Discovery tier with the "stay close to hyperscaler deals" creditworthiness criterion.

---

## 2. Per-Ticker Timeline (across covered quarters)

> Legend: ✓ held with thesis | ↑ promoted / increased emphasis | ↓ de-emphasized | ✗ dropped / closed | — not in list

| Ticker | Q4 2025 | Q1 2026 | Q2 2026 | Net trajectory |
|---|---|---|---|---|
| **NVDA** | ✓ #1 accelerator | ✓ "greater emphasis on memory" | ✗ **closed** | Closed at $209.67 (2026-04-27) on Rubin delay + custom silicon competition; ~0.2% starter re-entry by late Aug 2026 |
| **AVGO** | ✓ #2 accelerator | ✓ Ethernet + custom silicon | ↑ **#1 accelerator** | Promoted as NVDA exited; trimmed May/June, ✗ **fully closed 2026-07-27 @ $380.66** |
| **AMD** | ✓ #3 accelerator | ✓ "element of surprise" | ✓ "underestimated/misunderstood" | Consistent hold; thesis around H2 2026 MI400 |
| **TSM** | ✓ #5 (5/10 fundamentals) | ✓ multi-year visibility | ✓ CoWoS linchpin | Absent from portfolio table since summer 2026; treat as exited |
| **MU** | ✓ #4 accelerator | ↑ memory crown from compute | ↑ "doors blown off" | Still held; trimmed 3× into strength May–Jul 2026 |
| **SNDK** | — | + Added (market leader 2026) | ✓ "thing in motion" | Held; now the largest memory weight (8.9%) |
| **ALAB** | ✓ tied #1 networking | ✓ Scorpio-X | ✓ bouncing off lows | Closed 2026-07-24, re-entered 2026-08-06 (4%) — churny but back in |
| **CRDO** | ✓ tied #1 networking | ✗ **dropped** | — | Dropped on copper-to-optics shift; **re-entered 2026-07-24 (4% + 2% add)** — the drop reversed |
| **LITE** | ✓ #4 networking | ↑ EMLs power 400G/800G | ↑ capacity-constrained | Strongly promoted; now the largest position (11.5%) after July adds |
| **COHR** | — | + Added (InP capacity doubling) | ✓ slow and steady | New Q1; held |
| **AAOI** | — | — | + **Added** | +~800% since November 2025 entry; added on every dip May–Jul |
| **VRT** | — | — | + **Added** | Absent from portfolio table since summer 2026; treat as exited |
| **RDDT** | ✓ #1 software/data | ✓ contextual high-intent data | ✓ scarce asset → ✗ **closed 2026-05-18** | Fully closed @ $158.85; post-Q2 exit |
| **CRWV** | ✓ #2 software (thematic 11/10) | ✓ legacy IaaS wasn't built for AI | ✗ **removed from list** | Debt trajectory (D/C ratio ~12× projected for 2026) finally too much |
| **ORCL** | ✓ #3 software | ✗ **dropped** | — | Dropped Q1 |
| **APP** | ✓ #4 software | ✓ sentiment doesn't match fundamentals | ✗ **dropped/de-emphasized** | Held Q4-Q1, exit by Q2 |
| **NET** | ✓ #5 software | ✓ early but unique | ✓ timing main question | Held; rebuilt with a 5% buy 2026-07-27 |
| **PLTR** | — | + Added (discipline vs conviction) | ✓ commercial surges → ↓ **~50% trimmed 2026-05-18** | Remaining half ✗ **closed 2026-06-25 @ $107.44** |
| **META** | — (honorable mention) | (honorable mention) | ✓ **added** (Mag 7) | Closed 2026-05-29 @ $627.97; 2% re-buy 7/27, ✗ **closed again 7/29 @ $543.36** on the Q2 print |
| **GOOG** | — | — | + **Added** (Mag 7) | ✗ **Fully closed 2026-06-25 @ $341.22** |
| **ARM** | — | — | + **Added** (AGI CPU) | Round-tripped: momentum buy 6/9, ✗ **closed 6/25 @ $347.09** despite thesis extension mid-June |
| **BE** | ✓ #1 energy | ✓ time-to-power | ✓ +1,300% from entry | Consistent hold; trimmed twice into strength |
| **GEV** | ✓ #2 energy | ✓ nat gas behemoth | ✓ held (order book to 2028) | Consistent hold; 7% trim 2026-07-22 |
| Bitcoin Miner | ✓ #3 energy (Discovery) | ✓ Discovery only | ✓ Discovery only | Gated to Discovery tier across all 3 |

**Post-Q2 entrants (no Top-15 column yet):** SIMO, SITM, MXL (built via repeated small buys May–Jul); MTSI (6/25); STX + WDC (the 7/27 storage rotation); short-lived round trips INOD (Jun), GLW (Jun–Jul), DDOG (Jul–Aug).

> Cross-reference any of these against the trade log (`query_trades`) for entry/exit prices and dates.

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
- **Sector saturation about to break.** AVGO promoted as NVDA's CUDA moat erodes.
- **Momentum entries, explicitly labeled.** June 2026 brought "momo"-tagged buys (ARM, INOD) held days-to-weeks and exited on strength — a trading register distinct from thesis positions.
- **Counter-narrative pricing.** MU when memory still seen as cyclical. AAOI after the market wrote it off.
- **Capex / capacity sellout.** GEV (gas turbines sold out to 2028). MU (NAND sold out 2026).

### Exit / closure triggers
- **Thesis-specific structural shift.** CRDO dropped when Rubin pushes optics (AEC content erodes). NVDA closed when Rubin HBM4 delay + inference moat softens.
- **Valuation extreme + softer fundamentals.** APP de-emphasized after sentiment vs fundamentals gap closed.
- **Cash/debt collapse risk.** CRWV removed when 2026 D/C projected to 12×.
- **Macro re-rating done.** ORCL after RPO surge played out.
- **Capex/FCF collapse + incoherent capital story.** META closed when capex consumed 97.5% of OCF, FCF fell 91% YoY, and the Meta Compute sell-compute-while-leasing contradiction became a credibility issue. Generalized into the theme-8 stance: avoid the spenders, own the suppliers.

### Sizing tells (cross-reference with trade log notes)
- New entry typically <2% of portfolio.
- "Build into strength" pattern → multiple adds within weeks of first entry.
- "Trim into strength" pattern → single position >10% triggers discretionary trim.
- "X% trim" alerts during sector strength = risk management, NOT thesis break.

### What IOF "watches without owning"
Several names tracked across multiple quarters without entering. Pattern usually = valuation extremity + valid thesis. E.g. Palantir (held Q1+Q2 finally) was "watched without action" for some time. CRWV was the inverse — thematic 11/10 but cash/debt prevented full conviction.

### Macro reading
- **Capex revisions are the single most-cited signal.** Big Tech capex 2025: estimates $250B → $365B → $435B → re-rated upward each quarter. 2026: $583B → $600B → **$732.5B guided (Aug 2026, +79% YoY), tracking ~$1T for 2027**. IOF uses capex revisions as the upstream signal for hardware demand.
- **Cluster of buys = market-low call.** 22 buys Feb–April 2025 (9 on April 4 low). Watch for similar clustering in trade log for the "bottom call" signal.

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
- **"Held" here means present in the 2026-08-30 portfolio table.** The quarterly narrative still dates to the Q2 2026 report (April 21); holdings and closures were reconciled against the trade log + portfolio table on 2026-08-30. Always cross-reference the trade log for activity since.
- **CoreWeave + Nvidia exits are the loudest signals in this 3-quarter window** — note how IOF telegraphed both via thesis weakening across quarters before fully exiting. Watch for similar gradual thesis erosion as an exit-prediction pattern.
- **The "Discovery tier" picks are the speculation slots.** When you see thematic discussion without a held ticker (e.g., utilities, miners), the actionable name is gated.
