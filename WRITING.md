# Writing style

Applies to every user-facing word in this project: the strategy/thesis pages, weekly
digests, distilled article summaries, chat replies, and UI microcopy — and to the LLM
prompts that generate that prose, where the tone is actually set (`scripts/digest_week.py`,
`scripts/ingest_articles.py`, `chat/lib/chat/system-prompt.ts`).

The target: prose that sounds like a person stating things directly. Plain, editorial,
trader-pragmatic — closer to a sharp research note than marketing copy. Sentence-case
headings. When unsure whether a sentence works, read it aloud.

## Voice anchor

Two writers to read for — both widely followed for explaining deep, technical material plainly,
not for any signature style. When a sentence feels off, ask: would one of them write it this way?
We're after their principles (fewest words, concrete over abstract, no throat-clearing, honest about
what isn't known), not their personal tics.

**Benedict Evans** — tech analyst; the primary anchor, closest to our domain. Plain words, concrete
everyday analogies in place of jargon, and honest about the unknown instead of overclaiming. He
explains what a calculator and a neural network actually do like this:

> "Calculators do super-human maths, and databases have super-human memory, but they can't do anything
> else, and they don't understand what they're doing, any more than a dishwasher understands dishes,
> or a drill understands holes."

And reasoning about what's genuinely uncertain — note how he names the unknowns plainly instead of
papering over them or overclaiming in either direction:

> "They don't know, either way, because we don't have a coherent theoretical model of what general
> intelligence really is, nor why people seem to be better at it than dogs, nor how exactly people or
> dogs are different to crows or indeed octopuses. Equally, we don't know why LLMs seem to work so
> well, and we don't know how much they can improve. We know, at a basic and mechanical level, about
> neurons and tokens, but we don't know why they work."

**Morgan Housel** — finance writer; the plainest register, for explaining an investing idea to a
non-expert. Says the most in the fewest words; every word earns its place:

> "Getting money requires taking risks, being optimistic, and putting yourself out there. But keeping
> money requires the opposite of taking risk."

(Borrow the plainness, not the aphorisms — Housel's punchy one-liners are his; see the no-tagline rule.)

## Project rules

- **No internal shorthand.** "I/O Fund", "the fund", or "the firm" — never "IOF" (the repo's
  internal name). Vary the choice; don't mechanically swap.
- **Never "the book."** Call it "the portfolio" or "holdings." ("A few names left the book
  recently" → "A few names recently left the portfolio.")
- **No paid content verbatim.** I/O Fund's articles are paid material. Everything we publish is
  a transformative summary — paraphrase, never quote prose.
- **No analyst names in user-facing prose.** Attribute to the firm, not the person.
- **Human pages are plain editorial.** No "agent", "decoder", "load-bearing", or other
  internal/meta vocabulary on `/fund/strategy`, `/fund/thesis`, or in digests. (The `.agent.md`
  decoder docs are exempt — they're not user-facing and stay terse/structured.)
- **Fix tone at the prompt, not the output.** Generated prose recurs every cron run, so a wording
  problem in a digest or summary is usually a prompt problem.

## AI tells to cut (subset of the `humanizer` skill)

- **Em dashes** — usually a colon, comma, or period works.
- **Rule of three.** Don't force ideas into triplets; a real three-step scale is fine, padding isn't.
- **Participial tack-ons:** "..., highlighting/underscoring/reflecting...". Cut or make a real sentence.
- **Negative parallelisms:** "not just X, but Y"; clipped tail negations ("no guessing").
- **Copula avoidance:** "serves as / functions as / stands as / boasts" → "is / has".
- **AI vocabulary:** delve, landscape, pivotal, crucial, testament, underscore, showcase, robust,
  vibrant, intricate, tapestry, regime, fostering, leveraging, accrete, throughline.
- **Don't announce the point:** "The throughline is that X", "The takeaway is X", "What's notable
  is X" → just state X.
- **Stock idioms / business clichés:** "doing the heavy lifting", "moving the needle", "the loudest
  call". Say what's actually happening.
- **False ranges:** "from X to Y" where X and Y aren't on a real scale.
- **Hedging stacks:** "could potentially possibly". One qualifier max.
- **Filler:** "it is important to note that", "in order to", "at this point in time".
- **Significance inflation:** something "represents a shift" or "plays a vital role" instead of saying
  what it does.
- **Generic upbeat endings** that gesture at a bright future instead of stating the finding.

## General patterns behind the rules

- **Plain and precise, not punchy and not vague.** A clause that would work on a billboard is
  usually wrong here. Tagline antithesis ("The team rarely abandons a theme; it widens one") reads
  like ad copy.
- **Adjectives and labels state, they don't sell.** "the week's loudest conviction call" → "the
  week's strongest theme"; "Power as the parallel bottleneck" → "Power is the other bottleneck."
- **No metacommentary.** A page shouldn't narrate its own structure or announce what each part
  contains. If the structure is good, it's visible.
- **Commit; don't hedge toward multiple futures.** State the call. Open questions go in a backlog, not
  woven into prose as caveats. One honest "this isn't known" is fine — saying plainly what we don't
  know (Evans does this constantly) beats faking certainty. What's banned is stacked qualifiers and
  prose written to survive a pending answer.
- **When two phrasings are equally accurate, prefer the shorter.** Don't coin label-like noun
  phrases — use plain description or the term the source already uses.

## Process

1. Draft clean — don't write dirty and fix later.
2. Audit the draft: "What makes this read as AI-generated?" Fix what surfaces (the `humanizer` skill).
3. When editing existing prose, make surgical edits. Fix the phrase, not the paragraph.
