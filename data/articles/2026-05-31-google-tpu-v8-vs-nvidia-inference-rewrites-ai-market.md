---
url: "https://io-fund.com/ai-stocks/google-tpu-v8-vs-nvidia-inference-rewrites-ai-market"
title: "Google TPU v8 vs Nvidia: How Inference Is Rewriting the AI Market"
pub_date: 2026-05-31
category: ai-stocks
tickers: [GOOGL, NVDA]
---

## Thesis
Google's formal entry into the merchant AI accelerator market with TPU v8 is well-timed against three converging forces: inference becoming the dominant AI workload, Google's architectural advantages in coherent shared memory and cost-per-token, and a potential Nvidia Rubin delay. However, I/O Fund believes neither Google nor Nvidia offers the best returns from here—infrastructure suppliers (networking, energy, memory) are preferred.

## Key numbers
- Inference vs. training split: 50/50 in 2026, shifting to ~60/40 inference-heavy by 2030 (93.3 GW vs. 62.2 GW)
- TPU 8i pod: 1,152 chips, 331.8 TB coherent HBM (7X over Ironwood's 49.2 TB); Nvidia NVL72 comparison: 20.7 TB coherent across 72 GPUs only
- TPU 8i on-chip SRAM: 384 MB per chip (3X increase); Boardfly topology cuts networking hops from 16 to 7, yielding ~50% latency improvement
- TPU 8i performance-per-dollar: up to 80% better than Ironwood
- Gemini serving cost reduction: 78% in 2025
- Gemini 3.1 blended token price: ~$1.74/1M tokens, ~58% cheaper than Claude Opus 4.7 (~$4.10) and ~60% cheaper than GPT-5.5 (~$4.35)
- Google Cloud Q1 2026: $20B revenue, 63% YoY growth, 32.9% operating margin (+15.1 pp YoY), backlog $462B (+400% YoY)
- Anthropic TPU commitment: 5 GW over 5 years with Google (~$200B) vs. ~1 GW with Azure and ~0.3 GW with SpaceX
- Rubin share of 2026 Nvidia GPU shipments revised down: 29% → 22% (TrendForce)

## Decision-relevant takeaways
- Coherent shared memory at pod scale is Google's primary architectural differentiator for inference; Nvidia's coherency is rack-limited at 72 GPUs.
- Anthropic's disproportionate TPU commitment (vs. Nvidia/AWS hardware) independently validates TPU economics for inference-heavy workloads.
- Google Cloud's margin expansion alongside low token pricing suggests TPU cost advantages are real, not subsidized share-grabbing.
- Nvidia is countering with disaggregated inference via the Groq LPX rack (35X throughput/MW claim on trillion-parameter models), so the competitive gap may narrow.

## Risks / watch-fors
- Nvidia Rubin delay is unconfirmed; CFO language suggests meaningful ramp in Q1 2027, but Nvidia has not acknowledged a delay—watch Q3 2026 shipment data.
- Nvidia's system-level disaggregation strategy (Rubin + Groq LPX co-design) could close Google's inference efficiency gap faster than expected.
- TPU merchant sales are still limited to select operators; scaling distribution and software ecosystem (vs. CUDA) remains an execution risk for Google.
