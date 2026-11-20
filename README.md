# Launch Desk

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/muammarkhadafi/gta6-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/muammarkhadafi/gta6-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every pre-token protocol in the sealed DefiLlama snapshot, ranked by what its launch would be worth, with a farm plan for each one.

## The model (radar-2)

No name is ever special-cased. Every row is scored by the same four steps, from the snapshot's own figures:

1. **Calibrate.** For each category, the median market-cap-to-TVL ratio of its tokenized protocols, shrunk toward the global median where the category has few peers, clamped to 0.02–2.00×.
2. **Base.** `TVL × category multiple` — what the protocol would be worth at its peers' valuation.
3. **Growth.** `1 + 0.35 × tanh(7-day change / 50)` — a hot week helps, but a single week cannot multiply a value.
4. **Maturity.** `0.75 + 0.25 × ln(1 + age) / ln(1 + 1095)` — longer with no token counts for more, with diminishing returns.
5. **Breadth.** `1 + 0.05 × min(chains − 1, 4)` — a protocol live on more chains reaches more users.

Implied value is the product of the four, rounded to whole dollars. The board covers all 40 watchlist protocols plus every other launch candidate below the floor. Protocols that already have a token trading are shown separately at the market's own values, never mixed into the ranking.

## The dashboard

`dashboard/` is a static page with no network: a sortable, filterable board, a detail view for every protocol with its model breakdown and farm plan, a live-token view, and the calibration table the snapshot produced. `main.ts` (Node 22) reads the sealed snapshot, writes `board.json` and `data.js`, and copies the dashboard into the output.

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
