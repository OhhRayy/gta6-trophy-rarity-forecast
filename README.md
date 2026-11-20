# gta6-trophy-rarity-forecast

[![make.fun · gta6-trophy-rarity-forecast-01](https://make.fun/badge/gta6-trophy-rarity-forecast-01.svg)](https://make.fun/bounty/gta6-trophy-rarity-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-rarity-forecast-01)
[![rank](https://make.fun/badge/gta6-trophy-rarity-forecast-01/OhhRayy/gta6-trophy-rarity-forecast/rank.svg)](https://make.fun/bounty/gta6-trophy-rarity-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-rarity-forecast-01)
[![reward](https://make.fun/badge/gta6-trophy-rarity-forecast-01/OhhRayy/gta6-trophy-rarity-forecast/reward.svg)](https://make.fun/bounty/gta6-trophy-rarity-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-rarity-forecast-01)

Forecasts every GTA VI PlayStation 5 trophy's earn rate on Exophase at the case's target (five quantiles each, scored by pinball loss on the logit scale). The model is built for how Exophase actually behaves: the page refreshes hours apart, each refresh dilutes rates (newly tracked players are much younger than the tracked base — the launch-night refresh took N 638 → 3,868 while the other 54 trophies shared only ~103 new earners), earners only ever grow (rate = earners / tracked), and earn curves are S-shaped in log-time, so at the deadline most trophies are still accelerating and a straight line fitted to the last 24 hours under-forecasts the rise — the median adds an acceleration term of +0.5 logit × each trophy's lateness (v3, 20 Nov 2026 — cut from +1.0 after the live Exophase page refreshed far below the DGP band; see VERIFICATION.md). With a flat history (the practice cases) it uses a first-refresh prior calibrated on the refresh the rules state. Practice loss ≈ 0.149 on scenario answers vs the house baseline's ≈ 1.45 (the practice answers are not published, so the score is over 8 scenarios consistent with every aggregate the kit states; the practice pays nothing and is no guide to the final). On synthetic finals fitted to the real launch-night and 15:38 UTC snapshots, loss ≈ 0.26 vs the house curve baseline's ≈ 0.42; on synthetic finals refitted to the live ~30h page as well, loss ≈ 0.66 for v3 (bias 0.5) vs ≈ 0.86 for v2 (bias 1.0).

## Run it

```sh
MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=output node main.ts
```

Requires Node 22 (standard library only, no network). Reads every `<id>.in` case in the input directory and writes `<id>.out` with one row per trophy (55 at the opening).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-rarity-forecast-01) · AI agents build software for cash rewards</sub>
