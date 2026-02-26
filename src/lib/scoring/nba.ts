import { type NbaGameData, type NbaOdds } from "../api/nba";
import { clampScore, getLabel, type ExcitementResult, type EasterEgg } from "./types";

const BASE_SCORE = 4.5;

function marginPoints(margin: number): number {
  if (margin <= 5) return 1.5;
  if (margin <= 10) return 1.0;
  if (margin <= 15) return 0.5;
  if (margin <= 20) return 0;
  if (margin <= 25) return -0.5;
  if (margin <= 35) return -1.0;
  return -1.5;
}

function leadChangesPoints(game: NbaGameData): number {
  const changes =
    game.homeStats?.leadChanges ?? game.awayStats?.leadChanges ?? 0;

  if (changes > 0) {
    if (changes >= 16) return 1.5;
    if (changes >= 11) return 1.0;
    if (changes >= 6) return 0.5;
    return 0.2;
  }

  // Fallback: compute from plays
  let leader: "home" | "away" | "tie" = "tie";
  let count = 0;
  for (const play of game.plays) {
    let newLeader: "home" | "away" | "tie";
    if (play.homeScore > play.awayScore) newLeader = "home";
    else if (play.awayScore > play.homeScore) newLeader = "away";
    else newLeader = "tie";
    if (newLeader !== "tie" && newLeader !== leader && leader !== "tie") {
      count++;
    }
    if (newLeader !== "tie") leader = newLeader;
  }
  if (count >= 16) return 1.5;
  if (count >= 11) return 1.0;
  if (count >= 6) return 0.5;
  return 0.2;
}

function overtimePoints(period: number): number {
  if (period <= 4) return 0;
  if (period === 5) return 2.0;
  return 2.5; // 2+ OT
}

function fourthQuarterClosenessPoints(game: NbaGameData): number {
  // Check last 2 min of Q4
  const q4Late = game.plays.filter(
    (p) => p.period === 4 && p.clockValue <= 120
  );
  const within3Last1min = q4Late.some(
    (p) => p.clockValue <= 60 && Math.abs(p.homeScore - p.awayScore) <= 3
  );
  const within5Last2min = q4Late.some(
    (p) => Math.abs(p.homeScore - p.awayScore) <= 5
  );

  if (within3Last1min) return 1.5;
  if (within5Last2min) return 1.0;
  return 0;
}

function comebackPoints(game: NbaGameData): number {
  const homeLargest = game.homeStats?.largestLead ?? 0;
  const awayLargest = game.awayStats?.largestLead ?? 0;
  const margin = game.homeTeam.score - game.awayTeam.score;

  // Check from stats first
  if (awayLargest >= 15 && margin >= 0) return 1.5;
  if (homeLargest >= 15 && margin <= 0) return 1.5;
  if (awayLargest >= 10 && margin >= 0) return 0.8;
  if (homeLargest >= 10 && margin <= 0) return 0.8;

  // Fallback from plays
  let maxHomeDeficit = 0;
  let maxAwayDeficit = 0;
  for (const play of game.plays) {
    const diff = play.homeScore - play.awayScore;
    if (diff < 0) maxHomeDeficit = Math.max(maxHomeDeficit, -diff);
    if (diff > 0) maxAwayDeficit = Math.max(maxAwayDeficit, diff);
  }
  const finalHome = game.homeTeam.score;
  const finalAway = game.awayTeam.score;
  if (maxHomeDeficit >= 15 && finalHome >= finalAway) return 1.5;
  if (maxAwayDeficit >= 15 && finalAway >= finalHome) return 1.5;
  if (maxHomeDeficit >= 10 && finalHome >= finalAway) return 0.8;
  if (maxAwayDeficit >= 10 && finalAway >= finalHome) return 0.8;
  return 0;
}

function winProbDramaPoints(game: NbaGameData): number {
  const swings = game.winProbSwings ?? 0;
  if (swings >= 15) return 1.0;
  if (swings >= 10) return 0.7;
  if (swings >= 5) return 0.4;
  if (swings >= 2) return 0.2;
  return 0;
}

function totalPointsPoints(game: NbaGameData): number {
  const total = game.homeTeam.score + game.awayTeam.score;
  if (total >= 270) return 0.4;
  if (total >= 250) return 0.25;
  if (total >= 230) return 0.15;
  return 0;
}

function pacePoints(game: NbaGameData): number {
  const homeFB = game.homeStats?.fastBreakPoints ?? 0;
  const awayFB = game.awayStats?.fastBreakPoints ?? 0;
  const total = homeFB + awayFB;
  if (total >= 30) return 0.3;
  if (total >= 20) return 0.15;
  return 0;
}

function standingsBonus(homeRank?: number, awayRank?: number): number {
  if (homeRank == null || awayRank == null) return 0;
  const bothTop5 = homeRank <= 5 && awayRank <= 5;
  const bothTop10 = homeRank <= 10 && awayRank <= 10;
  const oneTop5 = homeRank <= 5 || awayRank <= 5;

  if (bothTop5) return 1.0;
  if (bothTop10) return 0.6;
  if (oneTop5) return 0.3;
  return 0;
}

export function calculateNbaExcitement(
  game: NbaGameData,
  homeRank?: number,
  awayRank?: number
): ExcitementResult {
  let points = BASE_SCORE;

  const margin = Math.abs(game.homeTeam.score - game.awayTeam.score);
  points += marginPoints(margin);
  points += leadChangesPoints(game);
  points += overtimePoints(game.period);
  points += fourthQuarterClosenessPoints(game);
  points += comebackPoints(game);
  points += winProbDramaPoints(game);
  points += totalPointsPoints(game);
  points += pacePoints(game);
  points += standingsBonus(homeRank, awayRank);

  const score = clampScore(points);
  return { score, label: getLabel(score) };
}

// ─── Odds-to-prediction translation helpers ─────────────────────────────────

/** Convert American moneyline to implied probability (0-1). */
function moneylineToProb(ml: number): number {
  if (ml < 0) return Math.abs(ml) / (Math.abs(ml) + 100);
  return 100 / (ml + 100);
}

/**
 * Competitiveness bonus based on moneyline balance (2-way, no draw in NBA).
 * Balanced odds suggest an unpredictable, competitive game (+bonus).
 * Lopsided odds suggest a mismatch (-penalty).
 * Range: -0.5 to +0.5
 */
function competitivenessBonus(homeMl?: number, awayMl?: number): number {
  if (homeMl == null || awayMl == null) return 0;

  const probs = [moneylineToProb(homeMl), moneylineToProb(awayMl)];
  const total = probs.reduce((sum, p) => sum + p, 0);
  const normalized = probs.map((p) => p / total);

  const mean = normalized.reduce((sum, p) => sum + p, 0) / normalized.length;
  const variance = normalized.reduce((sum, p) => sum + (p - mean) ** 2, 0) / normalized.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev <= 0.03) return 0.5;
  if (stdDev <= 0.06) return 0.3;
  if (stdDev <= 0.10) return 0.1;
  if (stdDev <= 0.15) return 0;
  if (stdDev <= 0.20) return -0.2;
  return -0.5;
}

// ─── Pre-game excitement prediction ─────────────────────────────────────────

export interface NbaPredictionInput {
  odds: NbaOdds;
  homeRank?: number;
  awayRank?: number;
}

export function predictNbaExcitement(input: NbaPredictionInput): ExcitementResult {
  const { odds, homeRank, awayRank } = input;

  // Translate odds to predicted game values
  const expectedTotal = odds.overUnder ?? 215; // NBA average ~215
  const expectedMargin = odds.spread != null ? Math.abs(odds.spread) : 5; // moderate default

  let points = BASE_SCORE;

  // Reuse post-game factor functions with predicted inputs
  points += marginPoints(expectedMargin);

  // totalPointsPoints: predict scoring volume from over/under
  if (expectedTotal >= 270) points += 0.4;
  else if (expectedTotal >= 250) points += 0.25;
  else if (expectedTotal >= 230) points += 0.15;

  // Competitiveness from moneyline balance
  points += competitivenessBonus(odds.homeMoneyline, odds.awayMoneyline);

  // Standings bonus
  points += standingsBonus(homeRank, awayRank);

  const score = clampScore(points);
  return { score, label: getLabel(score), predicted: true };
}

// ─── Easter egg detection (post-game only) ──────────────────────────────────

export function detectNbaEasterEggs(game: NbaGameData): EasterEgg[] {
  const eggs: EasterEgg[] = [];
  const total = game.homeTeam.score + game.awayTeam.score;

  // Cardiac Finish: within 3 pts in last 60s of Q4
  const q4Late = game.plays.filter((p) => p.period === 4 && p.clockValue <= 60);
  if (q4Late.some((p) => Math.abs(p.homeScore - p.awayScore) <= 3)) {
    eggs.push({ id: "cardiac", emoji: "\u{1F493}", label: "Cardiac Finish", tooltip: "Neck and neck in the final minute" });
  }

  // Rollercoaster: 16+ lead changes
  const changes = game.homeStats?.leadChanges ?? game.awayStats?.leadChanges ?? 0;
  if (changes >= 16) {
    eggs.push({ id: "rollercoaster", emoji: "\u{1F3A2}", label: "Rollercoaster", tooltip: "The lead swung back and forth constantly" });
  }

  // Drama Alert: 15+ win probability swings
  if ((game.winProbSwings ?? 0) >= 15) {
    eggs.push({ id: "drama", emoji: "\u{1F3AD}", label: "Drama Alert", tooltip: "Win probability was all over the place" });
  }

  // Offensive Explosion: 270+ total points
  if (total >= 270) {
    eggs.push({ id: "offensive", emoji: "\u{1F4A5}", label: "Offensive Explosion", tooltip: "Points galore in this high-scoring affair" });
  }

  // Defensive Battle: 170 or fewer total points
  if (total <= 170) {
    eggs.push({ id: "defensive", emoji: "\u{1F6E1}\u{FE0F}", label: "Defensive Battle", tooltip: "A grinding, low-scoring defensive game" });
  }

  // Extra Time: OT
  if (game.period > 4) {
    eggs.push({ id: "overtime", emoji: "\u{23F0}", label: "Extra Time", tooltip: "This game needed overtime to decide" });
  }

  // Comeback Trail: overcame 15+ point deficit
  const homeLargest = game.homeStats?.largestLead ?? 0;
  const awayLargest = game.awayStats?.largestLead ?? 0;
  const margin = game.homeTeam.score - game.awayTeam.score;
  if ((awayLargest >= 15 && margin >= 0) || (homeLargest >= 15 && margin <= 0)) {
    eggs.push({ id: "comeback", emoji: "\u{1F525}", label: "Comeback Trail", tooltip: "A team erased a 15+ point deficit" });
  }

  return eggs;
}
