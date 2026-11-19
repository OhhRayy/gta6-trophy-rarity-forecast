// gta6-trophy-rarity-forecast-01 entry (Node 22, standard library only).
//
// What it forecasts: for every GTA VI PS5 trophy, its earn rate on Exophase at
// the case's target, as five quantiles (0.05/0.25/0.5/0.75/0.95), scored by
// pinball loss on the logit scale.
//
// The data-generating process the model is built for (from the kit's own rules
// and the public Exophase page, NOT from any per-trophy answer, which the kit
// does not publish):
//   - Exophase refreshes a game's counts on its own schedule, hours apart, not
//     continuously. Between refreshes the page is frozen; at a refresh the
//     tracked-player count N jumps and every rate moves at once.
//   - A refresh DILUTES rates: the players who sync between refreshes are on
//     average much "younger" (fewer hours played) than the players tracked
//     before, so they hold far fewer trophies. The launch-night refresh the
//     rules describe (N 638 -> 3,868, trophies earned 943 -> 4,276) is the
//     proof: the 3,230 new players earned only 3,333 trophies between them
//     (~1.03 each), and every one of them earned "Just Like Paradise" (that
//     trophy stayed at 100%), so the other 54 trophies shared only ~103 new
//     earners. Dilution hits late/hard trophies hardest and early/easy
//     trophies least: by the public page on 19 Nov ~15:38 UTC, "Beat Cal in a
//     fishing challenge" had fallen only 2.04% -> 1.89% while the final-mission
//     trophy had fallen 1.10% -> 0.06%.
//   - Earners only ever grow: E_i(t), the count of tracked players holding
//     trophy i, is monotone non-decreasing. A rate can fall only because N
//     grows faster than E_i. So r_i(t) = E_i(t) / N(t).
//   - Trophy earn curves are S-shaped in log-time: a player syncs, then earns
//     a trophy after a delay (hours to days of play). At the deadline most
//     trophies are still on the CONVEX, accelerating part of their curve: the
//     bulk of players arrived Nov 19-20 and have not yet reached their median
//     delay (the 15:38 snapshot puts typical delays at ~3-5 days). A straight
//     line fitted to the last 24 hours therefore UNDER-forecasts the rise over
//     the next 4.5 days, worst for late trophies. The model corrects for that
//     with an acceleration term, +1.0 logit x LATENESS, on the median. It was
//     validated on synthetic finals built from a cohort/delay model fitted to
//     the real launch-night and 15:38 UTC snapshots: the correction wins in
//     13 of 16 worlds spanning sharper/flatter curves and faster/slower
//     player growth (mean loss 0.28 vs 0.42 for the uncorrected line), and the
//     plain line is kept as the base so the correction is an adjustment, not
//     the forecast.
//
// The model, per case:
//   1. Collapse the history to its DISTINCT states (consecutive identical
//      reads are one frozen page, not new information).
//   2. If the history has at most one distinct state (the practice cases:
//      launch night, flat), no trend can be fit. Use the first-refresh prior:
//      one refresh before the target adds 3,230 newly tracked players who
//      average 1.03 trophies each; every one of them earns "Just Like
//      Paradise", and the remaining ~103 trophies are spread over the other
//      trophies by how early/easy each is (LATENESS below, exp-decay). The
//      constants 3,230 / 1.03 come from the refresh the rules state
//      (N 638 -> 3,868, earned 943 -> 4,276); the per-trophy split comes from
//      the trophy descriptions, never from an answer.
//   3. Otherwise, per trophy, an unweighted least-squares line of logit(rate)
//      on x = ln(1 + hours since release) over the last 24 hours of distinct
//      states (all states if fewer than 3 fall in the window), read at the
//      target — the house curve baseline's median, which backtests as the
//      strongest simple forecaster — plus the acceleration term above. The
//      forecast N(target) (log N on x, same window logic) enforces the exact
//      constraints E_i(target) >= E_i(last) (earners never decrease) and
//      E_i(target) <= E_i(last) + new players (a trophy is earned at most
//      once per new player), with safety margins on N(target).
//   4. Spread: 0.8 x the house curve baseline's spread
//      (sqrt(random-walk^2 + fit-residual^2)), floored at 0.35 and capped at
//      2.5 logit units; the flat branch adds a refresh-jump component
//      (0.48) because a refresh the history has not seen yet is its dominant
//      risk. The spread is honest-to-wide: on the logit scale a band that is
//      too narrow pays for every trophy outside it, while a band that is too
//      wide pays only a little at each quantile when the answer lands central.
//
// Deterministic: pure functions of the case file, no randomness, no network,
// no input besides the case file. Runtime is milliseconds per case.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const LEVELS = [0.05, 0.25, 0.5, 0.75, 0.95];
const Z = [-1.645, -0.674, 0, 0.674, 1.645];

/**
 * How late / hard each trophy is: 0 = earned in the first hour by almost
 * everyone who plays (Gone Fishing), 1 = only the most dedicated players
 * reach it in week one (platinum, 100% completion, big grinds). Indexed by
 * trophy id - 1, in Exophase's list order. Judged from each trophy's
 * description and tier only: story chapters in order, side-mission finals
 * mid-way, count/collect grinds late, one-off easy actions early. This is
 * the model's only use of trophy content; it never sees an answer.
 */
const LATENESS: number[] = [
  1.0, // 1 Vice Got a Price! — platinum, needs every other trophy
  0.0, // 2 Just Like Paradise — Complete Gone Fishing (the opener)
  0.22, // 3 Paradise Lost — Chapter 1
  0.45, // 4 Chapter 2
  0.6, // 5 Chapter 3
  0.72, // 6 Chapter 4
  0.88, // 7 final mission (gold)
  0.55, // 8 Breakfast Run (side mission)
  0.62, // 9 The Cartel Heist
  0.58, // 10 Child's Play
  0.6, // 11 Headliners
  0.63, // 12 VCIA Takedown
  0.66, // 13 Operation Savage Glory
  1.0, // 14 100% Completion (gold)
  0.95, // 15 250 Stunts (silver)
  0.3, // 16 Try each type of activity once
  0.85, // 17 gold medal in all Shooting Range challenges (silver)
  0.8, // 18 Top Fun Drone Race at every location
  0.7, // 19 Win 20 different races
  0.12, // 20 Beat Cal in a fishing challenge
  0.18, // 21 Complete an arcade game
  0.6, // 22 final mission for Andy
  0.6, // 23 final mission for Kenton
  0.6, // 24 final mission for Billy
  0.85, // 25 8 mission strands for strangers (silver)
  0.6, // 26 final mission for Randy
  0.6, // 27 final mission for Tyrone
  0.85, // 28 Meditate at every spot
  0.55, // 29 Hunt a unique animal
  0.9, // 30 3 Collectible Card sets (silver)
  0.95, // 31 WAiNK It at 100 locations (silver)
  0.85, // 32 Complete 50 Challenges
  0.35, // 33 Lose a 4 star Wanted Level with your partner
  0.3, // 34 Rob 3 shops back-to-back
  0.75, // 35 Discover 100 vehicles
  0.4, // 36 Take down 5 enemies in one Combat Focus
  0.38, // 37 Unscheduled departure at VCIA
  0.5, // 38 Rhinos (needs a Rhino tank)
  0.45, // 39 Rob a jewelry store undetected
  0.8, // 40 Rob 5 Bank Vaults (silver)
  0.45, // 41 Rob an Armored Truck
  0.8, // 42 Explore all of Leonida
  0.7, // 43 Rob an Illegal Operation of each gang
  0.15, // 44 Cocktail with a view on Ocean Beach
  0.35, // 45 Smash out of a vehicle showroom
  0.25, // 46 Bowling follow-through
  0.5, // 47 A partnership with mass appeal
  0.5, // 48 Choices made
  0.5, // 49 Second time's the charm
  0.55, // 50 What the hell just happened?
  0.35, // 51 Bowl 'em over with a melee drive-by
  0.75, // 52 Earn $250,000 laundering Marked Bills
  0.55, // 53 Spend $100,000 across all shops
  0.85, // 54 Purchase all garage properties
  0.45, // 55 Register 10 vehicles
];

// First-refresh prior (flat-history branch): the refresh the rules state for
// launch night. New players tracked by the refresh, and how many trophies
// they average between them (the 100% trophy takes exactly 1.0 of that each:
// every new player earned it, since it stayed at 100%).
const REFRESH_NEW_PLAYERS = 3230;
const REFRESH_TROPHIES_PER_NEW_PLAYER = 1.032;
// How sharply the remaining new trophies concentrate on early trophies:
// p_i proportional to exp(-LATE_SHAPE * lateness_i).
const LATE_SHAPE = 5.0;

// Trend branch constants.
const RECENT_HOURS = 24; // fit window for the per-trophy line
const ACCEL_BIAS = 1.0; // logit added to the median, times LATENESS
const SPREAD_SCALE = 0.8; // times the house curve baseline's spread
const RANDOM_WALK_SIGMA = 0.5; // logit spread per sqrt(day), as the baseline
const FLAT_JUMP_SIGMA = 0.48; // extra spread: a refresh not yet seen
const HORIZON_SIGMA = 0.55; // logit spread per sqrt(day), flat branch only
const SPREAD_FLOOR = 0.35;
const SPREAD_CAP = 2.5;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const clampRate = (x: number): number => clamp(x, 0.01, 99.99);
const logit = (pct: number): number => {
  const p = clampRate(pct) / 100;
  return Math.log(p / (1 - p));
};
const invLogit = (l: number): number => clampRate(100 / (1 + Math.exp(-l)));
const round4 = (x: number): number => Math.round(x * 10000) / 10000;

interface Trophy {
  id: number;
}
interface Read {
  slot: string;
  at: string;
  players_tracked: number;
  trophies_earned: number;
  rates: Array<number | null>;
}
interface Game {
  release_date: string;
}
interface Case {
  levels: number[];
  horizon_minutes: number;
  trophies: Trophy[];
  history: Read[];
  game: Game;
}

interface State {
  x: number; // ln(1 + hours since release)
  hours: number;
  n: number;
  rates: Array<number | null>;
}

/** Unweighted least squares of y on x. Returns slope, intercept, and the
 *  root-mean-square residual (0 when fewer than 3 points). */
function linFit(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number; resid: number } {
  const n = xs.length;
  if (n === 0) return { slope: 0, intercept: 0, resid: 0 };
  if (n === 1) return { slope: 0, intercept: ys[0], resid: 0 };
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    sxx += dx * dx;
    sxy += dx * (ys[i] - my);
  }
  const slope = sxx > 1e-12 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const r = ys[i] - (intercept + slope * xs[i]);
    ss += r * r;
  }
  return { slope, intercept, resid: Math.sqrt(ss / n) };
}

/** The first-refresh prior: one refresh before the target. Returns the
 *  median rate (percent) per trophy. */
function flatPriorMedian(lastRates: Array<number | null>, lastN: number): number[] {
  // New-cohort earn probabilities for every trophy except id 2 (index 1),
  // which every new player earns. The rest share
  // (trophies-per-new-player - 1) trophies each, split by lateness.
  const rest = Math.max(0, REFRESH_TROPHIES_PER_NEW_PLAYER - 1);
  let wSum = 0;
  const w: number[] = lastRates.map((_, i) => {
    if (i === 1) return 0;
    const v = Math.exp(-LATE_SHAPE * (LATENESS[i] ?? 0.6));
    wSum += v;
    return v;
  });
  const n1 = lastN + REFRESH_NEW_PLAYERS;
  return lastRates.map((r, i) => {
    const last = r ?? 0;
    const e0 = (last * lastN) / 100;
    let e1: number;
    if (i === 1) {
      e1 = e0 + REFRESH_NEW_PLAYERS; // every new player earns it
    } else {
      const p = wSum > 0 ? (rest * w[i]) / wSum : 0;
      e1 = e0 + REFRESH_NEW_PLAYERS * p;
    }
    return clampRate((e1 / n1) * 100);
  });
}

function forecastCase(c: Case): Array<{ id: number; q: number[] }> {
  const nT = c.trophies.length;
  const horizonDays = c.horizon_minutes / 1440;
  let releaseMs = Date.parse(c.game.release_date);
  if (Number.isNaN(releaseMs)) {
    releaseMs = c.history.length > 0 ? Date.parse(c.history[0].slot) : Date.now();
  }
  const lastRead = c.history[c.history.length - 1];
  const targetHours = lastRead
    ? Math.max(0, (Date.parse(lastRead.slot) - releaseMs) / 3.6e6 + c.horizon_minutes / 60)
    : c.horizon_minutes / 60;
  const xTarget = Math.log(1 + targetHours);

  // Distinct states: collapse consecutive identical reads (a frozen page).
  const states: State[] = [];
  for (const h of c.history) {
    const hours = Math.max(0, (Date.parse(h.slot) - releaseMs) / 3.6e6);
    const st: State = { x: Math.log(1 + hours), hours, n: h.players_tracked, rates: h.rates };
    const prev = states[states.length - 1];
    if (
      prev &&
      prev.n === st.n &&
      prev.rates.length === st.rates.length &&
      prev.rates.every((v, i) => v === st.rates[i])
    ) {
      continue;
    }
    states.push(st);
  }
  const last = states[states.length - 1];
  if (!last) {
    // No history at all: a flat, wide forecast (cannot happen per the rules).
    return c.trophies.map((t) => ({
      id: t.id,
      q: Z.map((z) => round4(invLogit(logit(0.5) + z * 1.5))),
    }));
  }
  const lastRates = last.rates;

  // ---- Flat-history branch: the first-refresh prior. ----
  if (states.length <= 1) {
    const med = flatPriorMedian(lastRates, last.n);
    const spread = Math.sqrt(
      FLAT_JUMP_SIGMA * FLAT_JUMP_SIGMA + HORIZON_SIGMA * HORIZON_SIGMA * horizonDays,
    );
    const s = clamp(spread, SPREAD_FLOOR, SPREAD_CAP);
    return c.trophies.map((t, i) => {
      const m = med[i] ?? 0.5;
      const l = logit(m);
      return { id: t.id, q: Z.map((z) => round4(invLogit(l + z * s))) };
    });
  }

  // ---- Trend branch: last-24h logit-linear fit + acceleration term. ----
  const recentCut = last.hours - RECENT_HOURS;
  const rw = RANDOM_WALK_SIGMA * Math.sqrt(horizonDays);

  // Forecast N(target): log N on x over the last 24h of states (all states
  // if fewer than 3 fall in the window), used only for the earner bounds.
  const nPtsAll = states.map((st) => ({ x: st.x, y: Math.log(Math.max(1, st.n)) }));
  const nPtsRecent = nPtsAll.filter((_, k) => states[k].hours >= recentCut);
  const nPts = nPtsRecent.length >= 3 ? nPtsRecent : nPtsAll;
  const nFit = linFit(
    nPts.map((p) => p.x),
    nPts.map((p) => p.y),
  );
  const nSlope = clamp(nFit.slope, -0.5, 3);
  // Recompute the intercept at the clamped slope.
  let nIntercept = Math.log(Math.max(1, last.n));
  if (nPts.length > 0) {
    let s = 0;
    for (const p of nPts) s += p.y - nSlope * p.x;
    nIntercept = s / nPts.length;
  }
  const nTarget = clamp(Math.exp(nIntercept + nSlope * xTarget), last.n, last.n * 50);

  const rows: Array<{ id: number; q: number[] }> = [];
  for (let i = 0; i < nT; i++) {
    const ptsAll: Array<{ x: number; y: number }> = [];
    const ptsRecent: Array<{ x: number; y: number }> = [];
    for (const st of states) {
      const r = st.rates[i];
      if (r === null || r === undefined) continue;
      const p = { x: st.x, y: logit(r) };
      ptsAll.push(p);
      if (st.hours >= recentCut) ptsRecent.push(p);
    }
    const pts = ptsRecent.length >= 3 ? ptsRecent : ptsAll;
    let med: number;
    let spread: number;
    if (pts.length === 0) {
      med = 0.5;
      spread = 1.5;
    } else if (pts.length === 1) {
      med = invLogit(pts[0].y);
      spread = Math.max(rw, 1.0);
    } else {
      const fit = linFit(
        pts.map((p) => p.x),
        pts.map((p) => p.y),
      );
      // Median: the fitted line at the target, plus the acceleration term.
      // Earn curves are S-shaped in log-time and still accelerating at the
      // checkpoint, so the line under-forecasts the rise; the correction
      // grows with how late/hard the trophy is.
      const lateness = LATENESS[i] ?? 0.6;
      const yHat = fit.intercept + fit.slope * xTarget + ACCEL_BIAS * lateness;
      med = invLogit(yHat);
      // Exact earner constraints, with safety margins on N(target):
      // earners never decrease; a trophy is earned at most once per player.
      const eLast = ((lastRates[i] ?? 0) * last.n) / 100;
      const floorRate = (eLast / Math.max(1, nTarget * 1.3)) * 100;
      const capRate = Math.min(
        99.99,
        ((eLast + Math.max(0, nTarget - last.n)) / Math.max(1, nTarget)) * 100,
      );
      med = clamp(med, Math.max(0.01, floorRate), Math.max(0.01, capRate));
      spread = SPREAD_SCALE * Math.sqrt(rw * rw + fit.resid * fit.resid);
    }
    const s = clamp(spread, SPREAD_FLOOR, SPREAD_CAP);
    const l = logit(med);
    rows.push({ id: c.trophies[i].id, q: Z.map((z) => round4(invLogit(l + z * s))) });
  }
  return rows;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const inputs = readdirSync(INPUT_DIR)
  .filter((f) => f.endsWith('.in'))
  .sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (c.levels.length !== LEVELS.length || c.levels.some((t, j) => t !== LEVELS[j])) {
    throw new Error(`${file} asks for levels ${JSON.stringify(c.levels)}, not ${JSON.stringify(LEVELS)}`);
  }
  if (c.trophies.length !== LATENESS.length) {
    // The game lists a different number of trophies than this entry's table
    // was built for: fall back to a neutral lateness for the extra/missing
    // ones rather than crashing (an invalid case scores worst).
    while (LATENESS.length < c.trophies.length) LATENESS.push(0.6);
  }
  const trophies = forecastCase(c);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ trophies })}\n`);
}
