---
purpose: How I/O Fund manages its portfolio — reading the alerts, sizing, stops, and hedging
audience: subscriber
last_updated: 2026-05-17
sources:
  - https://io-fund.com/our-process
  - https://io-fund.com/risk-management
---

I/O Fund runs one actively managed, tech-only portfolio. Entries are timed off technicals, but every position sits on top of a product-first fundamental thesis. When the team thinks the broader market is fragile, they hedge by shorting a correlated index ETF. Every trade is disclosed in real time over SMS and email, so what you see is what they're doing with their own money.

This page covers how to read those alerts and how the portfolio is run day to day.

## Reading the trade alerts

The percentage in an alert is a share of the whole portfolio, cash included. It is not a share of what's already invested.

Say the alert reads "Bought XYZ at $30.36, 3% added." On a $1,000 portfolio holding $800 in stocks and $200 in cash, that's $30 of XYZ: 3% of the full $1,000, not 3% of the invested $800.

That one detail trips up most people. And since the cash balance is never published, you can't back exact dollar amounts out of an alert on its own. You'd need to know the current cash level, which the team keeps private.

A few things the alerts deliberately leave out:

- Cash level. Privately managed; historically anywhere from 0% to about 45%.
- Exact stop prices. Withheld so the positions can't be front-run.
- Hedge sizing. Only discussed in the weekly webinars.

The wording itself tells you what kind of move it is:

| Alert | What it means |
|---|---|
| BUY … N% Add | Adding to a position they already hold. They like the entry here. |
| BUY … N% (or Open) | Starting a new position. Usually small, 2% or less. |
| SELL … N% Trim | Cutting the position down. Risk got too high to hold full size, not always a broken thesis. |
| SELL … Close | Out entirely. The thesis broke, risk got too heavy, or a stop was hit. |
| Leading asterisk (\*) | A position that had been hidden from the public portfolio, revealed after the fact. |

## How positions get sized

New positions start small, under 2% of the portfolio, then get built in tranches. Sometimes that's into strength, sometimes into weakness when conviction is high. A single name rarely runs past about 10%; above that the team usually trims. Most positions get 5–10% of room before a stop comes into play.

## Stops

| Type | Trigger | What happens |
|---|---|---|
| Price stop (new positions) | A daily close below the stop level | Sold at the next open, no second-guessing |
| Fundamental stop | A key metric reverses or the thesis breaks | Sold even if the price is holding up |
| Removed | Position has earned "long-haul" status | Stop comes off; held through drawdowns as long as the story holds |

Roughly half of new entries stop out for a small loss and get re-attempted on the next setup. The ones that survive tend to become the long-haul holdings.

## Hedging

When the book needs protection, the team shorts the most correlated liquid index ETF, usually QQQ (or SOXX when the portfolio is semiconductor-heavy). Size depends on how correlated the overall portfolio is at the time.

Two signals drive it:

- Risk Index. Derived from the options market. Fires about four times a year and tends to warn earliest.
- QQQ Hedge Signal. A multi-factor read on breadth, options, momentum, and dark-pool volume. Fires roughly once a year and is the primary risk signal.

Hedges show up in the trade log as a short or sell on QQQ, SOXX, or a similar ETF. They often lead broader market weakness by days or weeks, so a hedge going on is worth paying attention to.

## What the timing tells you

The alerts carry a macro read, not just stock-by-stock conviction. A cluster of buys usually means the team thinks the market has bottomed; a run of trims and closes means they're de-risking. When a hedge is already on, individual buy alerts mean less than they would in an unhedged book, since the long exposure is partly offset.

A few patterns worth recognizing:

- Buying hard into market lows. In early 2025 there were 22 buys between February and April, nine of them on the April 4 low alone.
- Rotating between sectors early: cloud in 2019, AI in 2022, AI energy in 2024, custom silicon and inference into 2026.
- Doubling down on weakness when the fundamentals still hold, but cutting fast when a stop hits.

## A note on the pie chart

The pie chart on the I/O Fund site shows percentages of the invested book only; cash isn't counted. The largest slice is the highest-conviction position at that moment. The chart updates irregularly and lags the alerts, so when the two disagree, trust the trade log.

## Cash

Cash isn't a leftover here, it's a position. It has run from near zero in the 2020–2021 bull market, up to 5–45% on defense through 2023 and 2024, and as high as 50% in January 2025 right before the February–April buying. Those calls get explained in the weekly webinars rather than in the alerts.

## Philosophy

The approach is VC-style on the fundamentals and technical on the entries. Tech moves in multi-year cycles driven by a handful of microtrends, and the goal is to own the few real winners through the whole cycle. The team trades actively rather than buying and holding, because tech drawdowns compound against you: a 50% loss needs a 100% gain just to get back to even. The mandate is tech-only, and there's no advisory layer. The published trades are simply what the team does with its own capital.

## Track record

Per I/O Fund's own disclosures:

- Up 326% cumulatively since inception, against +192 points for the S&P and +152 for the Nasdaq-100.
- 2025: +37% overall and +56% equity-only, which they put at 8th-best among US hedge funds for the year and 3rd-best equity-only.
- More than 30 premium-alert trades have returned over 100%.

Some of the headline wins:

- Bloom Energy (2025): +305% on the core position, +422% from the lowest entry, built April through July.
- Astera Labs (2025): +140%, versus +26% for buy-and-hold.
- Nvidia (2020–2025): nine buy alerts under $20 in 2021 and 2022, including one at $10.85 on the October 2022 low; trimmed around $130.88 in 2025 and re-entered near $91.
- Bitcoin (2022–2025): 13 buys between $25K and $60K, exited from April to December 2025 in the $85K–$113K range.
- Super Micro (2024): +243% realized, trimmed ahead of the volatility.
