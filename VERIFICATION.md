# GTA VI trophy rarity forecast — entry verification (19 Nov 2026)

## Entry
- Repo: https://github.com/OhhRayy/gta6-trophy-rarity-forecast (public)
- `main.ts` (Node 22, stdlib only) + MIT `LICENSE` (SPDX line, copied from the
  kit starter) + `README.md` + `.makefun/owner.json` (payout wallet
  `J4ZWwPU7z8jcEXvc7RWCBMzmoAp1hXp9rd72wvrdu6i5`)
- Bounty: `gta6-trophy-rarity-forecast-01`, $250 USDC escrow (20 places,
  1st $50), deadline Sat 21 Nov 2026 11:30 UTC (18:30 WIB). Target rates at
  2026-11-26T00:00:00Z. Max 10 submissions/day, 20 total. Transcripts
  required with every submission; `handed_over_places: none`.
- Kit: `~/workspace/makefun/gta6-trophy-rarity-forecast-01-kit/` (bundle
  `bc675240...`). Practice: p00/p01, checkpoints 03:00/03:30 UTC 19 Nov,
  90-min horizon. Final: f00, checkpoint = deadline, horizon 6,510 min.

## Method (main.ts)
- Distinct states: consecutive identical reads collapse (the page is frozen
  between Exophase refreshes, hours apart).
- Flat history (≤1 distinct state — the practice cases): first-refresh prior.
  One refresh adds 3,230 newly tracked players averaging 1.03 trophies each
  (the refresh the rules state: N 638 → 3,868, earned 943 → 4,276); every
  new player earns "Just Like Paradise" (it stayed at 100%), the other ~103
  trophies split over the other 54 trophies by lateness, p ∝ exp(-5·L).
  Spread 0.50 logit (0.48 jump + horizon term).
- Rich history (the final): per trophy, unweighted least-squares line of
  logit(rate) on x = ln(1 + hours since release) over the last 24h of
  distinct states, read at the target — the house curve baseline's median —
  plus an acceleration term +1.0 logit × LATENESS. Earn curves are S-shaped
  in log-time and still accelerating at the checkpoint, so the line
  under-forecasts the rise, worst for late trophies. Spread =
  0.8 × sqrt(random-walk² + fit-residual²), floored 0.35, capped 2.5.
- Exact earner bounds from the forecast N(target): earners never decrease,
  a trophy is earned at most once per new player (with safety margins on N).
- LATENESS (55 values, trophy id order) is judged from each trophy's
  description + tier only. The program never sees an answer and uses no
  network; deterministic, ~0.2 s for 8 cases (cap 8 s/case).

## Verification (local scorer: exact RULES pinball on the logit scale)
- Format: 55 rows, 5 finite non-decreasing quantiles each in [0, 100],
  one row per trophy, only the `trophies` key; outputs 2,779 bytes (cap
  65,536). Valid = 1 on every run. Deterministic: two runs byte-identical.
- Practice: the kit publishes NO per-trophy practice answers (the 04:30Z /
  05:00Z reads are no longer on the live page — it has refreshed since;
  Wayback has no snapshot). Scored instead over 8 scenarios, all consistent
  with every hard aggregate the kit states (N 3,868, earned 4,276, trophy 2
  at 100%, every other rate down, integer earners). Entry v2: mean 0.1490,
  worst 0.1931; house baseline on the same scenarios: mean 1.4466, worst
  1.5315 (the rules say the baseline scores ~1.51 — the scenarios reproduce
  that scale). Coverage 0.96–0.98.
- Synthetic finals: cohort/delay worlds (players arrive as N grows, earn
  each trophy after a lognormal delay; per-trophy delays SOLVED so the world
  reproduces the real live Exophase page at 19 Nov ~15:38 UTC exactly, and
  the known launch-night points). 8 main worlds: entry 0.2602 mean / 0.3970
  worst vs house curve baseline 0.4213 / 0.7190 and persistence 0.9932 /
  1.4012. 16 robustness worlds (σ 0.7/1.3, head start 1h/4h, 4 N-growth
  shapes): entry 0.2856 / 0.5055 vs plain line 0.4222 / 0.9148; the
  acceleration term wins in 13 of 16 worlds.
- Rejected after testing: per-trophy quadratic in x (explodes on 4–8 points,
  loss >1.0); full-history slope blend (the launch-night dilution collapse
  drags the slope down, 0.97); damping the extrapolated move (0.58–0.66);
  slope shrinkage toward the pooled slope (no gain); wider spreads (cost
  when the median is right). A Python mirror of the trend branch reproduces
  the TypeScript outputs exactly (max diff 0.0 on v1; v2 scored directly
  from the TS outputs and matches the Python model's numbers).
- DGP bug found and fixed during validation: the first synthetic generator
  counted not-yet-arrived cohorts (head start applied to future arrivals),
  which inflated trophy 2's history above 100% and corrupted the curve
  baseline's fit on some seeds; v3 of the generator integrates cohorts on a
  grid containing every evaluation time, so no rate can exceed 100% (verified
  max rate = 100.00). All numbers above are from the fixed generator.

## Honest caveats (read before submitting)
- The practice leaderboard's top scores (loss 0.006–0.03, typical miss 0.00)
  are not modelling: they can only come from recovering the 04:30Z read
  itself (e.g. fetching the live page while it still showed it). The
  practice pays nothing and the practice floor does not apply to this
  competition (`applies: false`), so do not chase those scores. The honest
  comparison is the leaderboard median (0.429) and the house baseline
  (~1.51): this entry's scenario score (~0.15) sits with the best honest
  models. The prize is decided ONLY by the final.
- The acceleration term (+1.0 × lateness) is calibrated on synthetic worlds
  fitted to two real snapshots (launch night + 15:38 UTC). Its direction
  (earn curves accelerating at the checkpoint) follows from the fitted
  delays (~3–5 days vs 59.5 h at the checkpoint), but its size is uncertain:
  it wins in 13/16 robustness worlds and loses in sharp-transition worlds
  (σ=0.7), where the recent slope already captures the rise.
- The final case's history (Nov 19–21) is not available yet; the trend
  branch is validated on synthetic histories only. A live-page re-check on
  20 Nov (day-2 rates vs the DGP's prediction) is the remaining validation
  step before the deadline; if day-2 rates are far below the DGP, lower
  ACCEL_BIAS toward 0.5–0.7.

## v3 — 20 Nov 2026 ~14:15 WIB (ACCEL_BIAS 1.0 -> 0.5)
- Live Exophase page refreshed between 03:59 UTC (still frozen) and 07:00 UTC.
  All 55 rates moved vs the 15:38 snapshot (sum 106.12 -> 126.53); mean dlogit
  -0.575 (41/55 down, median -1.099) vs the DGP 28h band mean +0.46 — the
  trigger set in the day-2 note fired. Ch1 0.73 -> 7.99%, fishing 1.89 ->
  10.57% (both far ABOVE the DGP band: early earners grew far faster than the
  DGP), arcade 0.41 -> 1.11% (below band), final 0.06 -> 0.02%. Dilution is
  far stronger than the DGP assumed: earner-monotonicity implies
  N(30h)/N(15.6h) >= 7 (vs 1.3-1.7x in the DGP).
- Refit (trophy-val/dgp4.py): cohort/delay DGP refitted to BOTH snapshots
  (15:38 + live ~30h); bias sweep on the refit synthetic finals: 0.5 beats
  1.0 in 12/12 live-consistent worlds (refit mean 0.659 vs 0.857; mild-3x
  dilution 0.287 vs 0.343); combined old+refit 0.490 vs 0.559. Old worlds
  still favour 1.0 (0.260 vs 0.322) but their N-growth is falsified.
  Practice score is IDENTICAL for every bias (0.1490/0.1931) — the practice
  cases have flat histories so the trend branch (and ACCEL_BIAS) never runs;
  the practice gate therefore ties rather than discriminates.
- Repo: main.ts (ACCEL_BIAS 0.5) + README + this section. Practice outputs
  valid, deterministic (two runs byte-identical). Full detail:
  trophy-val/day2_recheck_20261120_pm.md.
- Force_Last: submitting v3 replaces v2 as the final entry. A last re-check
  is still needed Sat 21 Nov morning before the 18:30 WIB deadline.

## Status / blocker
- Entry built + verified. NOT submitted: bundle + submit is the parent
  agent's step (this subagent cannot bundle/submit its own run — the usage
  row is written after the run ends). Session file for the bundle:
  `~/agents/agent-ea61e0cc-9530-4dbe-9cd4-9f2d737005af/sessions/ea61e0cc-9530-4dbe-9cd4-9f2d737005af.jsonl`.
- Validation scratch (not in the repo): `~/workspace/makefun/trophy-val/`
  (score.py, gen_scenarios.py, dgp3.py, backtest.py, sweep*.py, robust.py,
  synth3/, synth4/, scenarios.json).
