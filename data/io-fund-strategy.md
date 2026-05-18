---
purpose: Operational reference for I/O Fund's strategy, alert semantics, sizing, hedging
load_priority: high
audience: agent
last_distilled: 2026-05-17
sources:
  - https://io-fund.com/our-process (strategy)
  - https://io-fund.com/risk-management (risk tools)
---

# I/O Fund — Strategy & Alert Decoding

Active, tech-only portfolio managed by Knox Ridley (PM) with thematic research from Beth Kindig. Hedged via short correlated ETFs. Technicals-driven entries on top of product-first fundamental theses. All trades disclosed in real time via SMS + email.

---

## 1. Alert Semantics (load-bearing)

### % in trade alerts is of TOTAL portfolio (including cash)

> Example: "Bought XYZ at $30.36 — 3% Added" with a $1,000 portfolio ($200 cash + $800 invested) means **$30 of XYZ** (3% of total $1,000), not 3% of the invested $800.

This is the single most important fact for sizing. Cash balance is NOT disclosed in alerts — agent cannot compute exact dollar sizes from alerts alone without knowing current cash %.

### Alert types

| Pattern | Meaning | Signal interpretation |
|---|---|---|
| `BUY ... N% Add` | Increasing existing position | Bullish; entry timing assessed as favorable |
| `BUY ... N%` (or `Open`) | Initiating new position | Conviction starter; typically ≤2% |
| `SELL ... N% Trim` | Reducing position size | Risk now too high to hold full size; not necessarily thesis-break |
| `SELL ... Close` | Exit entire position | Thesis broken OR risk overweight OR stop hit |
| `* ` prefix (asterisk) | Position previously masked from public portfolio | Reveals after exit / late |

### What alerts deliberately do NOT include
- **Cash allocation** — privately managed, varies 0–45% historically
- **Exact stop prices** — withheld to avoid front-running
- **Hedge sizes** — only mentioned in webinars

### Hidden timing signal
- Buy/sell timing often reflects **macro** read (risk-on / risk-off), not just stock-specific conviction. Cluster of buys = market low call. Cluster of sells/trims = de-risking.

---

## 2. Position Sizing Rules

| Rule | Value |
|---|---|
| Initial position | <2% of portfolio |
| Build pattern | Layer in tranches on strength or on conviction-weakness |
| Soft cap (single position) | ~10% — discretionary trim above |
| Loss tolerance per position | 5–10% before stop |

---

## 3. Stop-Loss Policy

| Stop type | Trigger | Behavior |
|---|---|---|
| **Price stop** (new positions) | Daily close below stop price | Sell at next open, no questions |
| **Fundamental stop** | Critical metric reverses, thesis breaks, sector saturating | Exit even if price-supportive |
| **Trailing / removed** | Position confirmed as "long-haul" | Stops removed; held through drawdowns while story intact |

Knox: ~50% of new entries hit their stop for a small loss, then re-attempt on next setup. Survivors become long-haul positions.

---

## 4. Hedging Framework

| Element | Detail |
|---|---|
| Mechanism | Short the most correlated, liquid broad-market ETF (typically QQQ; sometimes SOXX for semi-heavy book) |
| Sizing | Based on aggregate portfolio correlation at the time |
| Trigger 1 — **Risk Index** | Options-market-derived. ~4 triggers/year. More sensitive, earlier warning. |
| Trigger 2 — **QQQ Hedge Signal** | Multi-factor (breadth, options, price momentum, dark-pool volume). ~1 trigger/year. Primary risk signal. |
| Provider | Outsourced to WealthUmbrella (Vincent Duchaine) — quant signals |

Hedge alerts appear in the trade log as SHORT/SELL on QQQ, SOXX, or similar.

---

## 5. Decision Heuristics for Agents

When parsing a new IOF alert, agents should consider:

1. **Is this thematic or tactical?** Open of new ticker → thematic conviction. Small trim on existing → likely tactical risk management.
2. **Is the market context risk-on or risk-off?** Check recent alerts: multiple buys clustering = bullish market call; multiple trims/closes = de-risking.
3. **Is there a hedge active?** If recent SHORT/SELL on QQQ/SOXX/correlated ETF, the book is hedged — long alerts mean less than they would in unhedged mode.
4. **Where is this stock in its IOF lifecycle?** New starter (<2%), building, full position, trimming back. Use the cumulative trade log for this ticker.
5. **What was the prior alert spacing?** Frequent activity on a name = active management cycle. Long silence = long-haul mode.

---

## 6. Philosophy (compressed)

- **Product-first fundamentals** (VC-style thesis) + **technicals for entries**.
- Tech follows **multi-year hype cycles** driven by microtrends. Goal: own the few winners through the cycle.
- **Active > buy-and-hold** because tech drawdowns are geometric (50% loss → needs 100% gain to recover).
- Tech-only mandate. No advisory role — published trades reflect what the team does with its own capital.

---

## 7. Portfolio Convention

- **Pie chart** on site shows % of *invested* book (NOT total). Cash excluded.
- Highest pie-chart % = highest current conviction.
- The PDF snapshot is updated irregularly and lags the trade log — **trade log is the source of truth**, not the pie chart.

---

## 8. Cash Management (historical context)

| Regime | Cash % | Period |
|---|---|---|
| Bull conviction | 0–10% | Late 2020 – 2021 |
| Defensive | 5–45% | 2023 – 2024 |
| Tactical peak | 50% | January 2025 (before Feb–April redeploy) |

Cash decisions are mentioned in weekly webinars but not in SMS/email alerts.

---

## 9. Behavior Patterns to Recognize

- **Cluster buys at market lows** — e.g. 22 buys Feb–April 2025; 9 on April 4 low alone.
- **Early sector rotation** — cloud 2019 → AI 2022 → AI Energy 2024 → custom silicon/inference 2026.
- **Doubles down on weakness** when fundamental story holds; cuts losses fast on stop-out.
- **Trims into strength** when a position exceeds ~10% of portfolio.
- **Hedge alerts often precede broader market weakness** by days/weeks (the Risk Index is leading).

---

## 10. Team & Track Record (reference)

### Roles
- **Knox Ridley** — Portfolio manager. All trade alerts originate from Knox. Technicals + WealthUmbrella quant signals.
- **Beth Kindig** — Lead Tech Analyst. Thematic deep dives, microtrend identification.
- **Damien Robbins, Royston Roche** — Equity analysts, fundamental + sector research.

### Track record (per IOF disclosures)
- Cumulative since inception: 326% (vs S&P +192 pts, Nasdaq-100 +152 pts).
- 2025: +37% total / +56% equity-only — claimed 8th-best US hedge fund 2025 / 3rd-best US equity-only portfolio.
- 30+ premium-alert trades have returned >100%.
- Beat top-performing funds 2020–2025 per Knox's bio.

### Headline wins (subscription disclosures)
- **Bloom Energy 2025**: +305% core / +422% lowest entry. Built Apr–Jul 2025.
- **Astera Labs 2025**: +140% (vs +26% buy-and-hold).
- **Nvidia 2020–2025**: 9 buy alerts <$20 (2021–2022) incl. one at $10.85 on Oct 2022 low. 2025: trimmed at $130.88 avg, re-entered at $91 avg.
- **Bitcoin 2022–2025**: 13 buys $25K–$60K. Exited Apr–Dec 2025 at $85K–$113K.
- **Super Micro 2024**: +243% realized; trimmed before vol.

---

## Notes for Future Agents

- This doc is the **decoder** for `data/iofund-trades.csv`. Always cross-reference an alert with the rules in §1 before reasoning about it.
- The trade log notes column should encode `% Add` / `% Trim` / `Close` etc. If parsing it loses notes, sizing reasoning will be wrong — see Phase 1 ingest pipeline.
- Cash % is the missing variable for dollar-precise sizing. If precise dollars matter for a recommendation, flag the cash-% unknown and produce a range.
- When a hedge is active, downstream long signals are partially neutralized — don't over-react to single long alerts during hedge windows.
