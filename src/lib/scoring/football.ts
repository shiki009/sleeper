import { type FootballMatch, type FootballOdds, type GoalEvent } from "../api/football-data";
import { clampScore, getLabel, type ExcitementResult, type EasterEgg } from "./types";

const BASE_SCORE = 4.5;
const PREDICTION_BASE_SCORE = 3.5;

// ─── Post-game factor functions ─────────────────────────────────────────────

function totalGoalsPoints(totalGoals: number): number {
  if (totalGoals === 0) return -1.5;
  if (totalGoals === 1) return -0.5;
  if (totalGoals === 2) return 0;
  if (totalGoals === 3) return 0.5;
  if (totalGoals === 4) return 0.8;
  return 1.2; // 5+
}

function closenessPoints(homeScore: number, awayScore: number): number {
  const diff = Math.abs(homeScore - awayScore);
  if (diff === 0) return 0.5;  // draw
  if (diff === 1) return 0.3;  // 1-goal game
  if (diff === 2) return 0;
  if (diff === 3) return -0.3;
  return -0.8; // 4+ goal blowout
}

function lateGoalsPoints(goals: GoalEvent[]): number {
  let pts = 0;
  for (const g of goals) {
    if (g.minute >= 90) pts += 0.7;
    else if (g.minute >= 75) pts += 0.4;
  }
  return Math.min(1.2, pts);
}

function leadChangesPoints(goals: GoalEvent[], homeId: string): number {
  let homeScore = 0;
  let awayScore = 0;
  let leader: "home" | "away" | "tie" = "tie";
  let changes = 0;

  for (const goal of goals) {
    if (goal.teamId === homeId) homeScore++;
    else awayScore++;

    let newLeader: "home" | "away" | "tie";
    if (homeScore > awayScore) newLeader = "home";
    else if (awayScore > homeScore) newLeader = "away";
    else newLeader = "tie";

    if (newLeader !== "tie" && newLeader !== leader && leader !== "tie") {
      changes++;
    }
    leader = newLeader;
  }

  if (changes === 0) return 0;
  if (changes === 1) return 0.8;
  return 1.5; // 2+
}

function redCardsPoints(match: FootballMatch): number {
  const reds = (match.cards || []).filter((c) => c.cardType === "red");
  return Math.min(0.6, reds.length * 0.3);
}

function comebackPoints(goals: GoalEvent[], homeId: string): number {
  let homeScore = 0;
  let awayScore = 0;
  let maxHomeDeficit = 0;
  let maxAwayDeficit = 0;

  for (const goal of goals) {
    if (goal.teamId === homeId) homeScore++;
    else awayScore++;
    maxHomeDeficit = Math.max(maxHomeDeficit, awayScore - homeScore);
    maxAwayDeficit = Math.max(maxAwayDeficit, homeScore - awayScore);
  }

  const finalDiff = homeScore - awayScore;
  if (maxHomeDeficit >= 2 && finalDiff >= 0) return 1.5;
  if (maxAwayDeficit >= 2 && finalDiff <= 0) return 1.5;
  return 0;
}

function lateEqualizerPoints(goals: GoalEvent[], homeId: string): number {
  let homeScore = 0;
  let awayScore = 0;
  for (const goal of goals) {
    if (goal.teamId === homeId) homeScore++;
    else awayScore++;
  }
  if (homeScore !== awayScore) return 0;
  const lastGoal = goals[goals.length - 1];
  if (lastGoal && lastGoal.minute >= 85) return 1.0;
  return 0;
}

function shotIntensityPoints(match: FootballMatch): number {
  const home = match.homeStats?.totalShots ?? 0;
  const away = match.awayStats?.totalShots ?? 0;
  const total = home + away;
  if (total >= 30) return 0.3;
  if (total >= 24) return 0.15;
  if (total >= 18) return 0;
  if (total >= 12) return -0.1;
  return -0.2;
}

function shotsOnTargetPoints(match: FootballMatch): number {
  const home = match.homeStats?.shotsOnTarget ?? 0;
  const away = match.awayStats?.shotsOnTarget ?? 0;
  const total = home + away;
  if (total >= 14) return 0.3;
  if (total >= 10) return 0.15;
  if (total >= 7) return 0;
  if (total >= 4) return -0.1;
  return -0.2;
}

function possessionPoints(match: FootballMatch): number {
  const homePoss = match.homeStats?.possessionPct ?? 50;
  const diff = Math.abs(homePoss - 50);
  if (diff <= 5) return 0.2;
  if (diff <= 10) return 0.1;
  if (diff <= 15) return 0;
  return -0.2;
}

function physicalPoints(match: FootballMatch): number {
  const fouls =
    (match.homeStats?.foulsCommitted ?? 0) +
    (match.awayStats?.foulsCommitted ?? 0);
  const yellows = (match.cards || []).filter(
    (c) => c.cardType === "yellow"
  ).length;
  const intensity = fouls + yellows * 3;
  if (intensity >= 35) return 0.2;
  if (intensity >= 28) return 0.1;
  if (intensity >= 20) return 0;
  return -0.1;
}

function knockoutBonus(match: FootballMatch): number {
  if (!match.isKnockout) return 0;

  const stageBonuses: Record<string, number> = {
    "Knockout Round Playoffs": 0.5,
    "Rd of 16": 0.7,
    "Quarterfinals": 0.9,
    "Semifinals": 1.1,
    "Final": 1.3,
  };

  let pts = stageBonuses[match.knockoutRound ?? ""] ?? 0.5;

  // Close aggregate bonus: 2nd leg with aggregate diff <= 1
  if (match.aggregateDiff != null && match.aggregateDiff <= 1) {
    pts += 0.5;
  }

  return pts;
}

function standingsBonus(homeRank?: number, awayRank?: number, totalTeams: number = 20): number {
  if (homeRank == null || awayRank == null) return 0;

  const top4Cutoff = Math.floor(totalTeams * 0.2);
  const top6Cutoff = Math.floor(totalTeams * 0.3);
  const top8Cutoff = Math.floor(totalTeams * 0.4);
  const bottom4Cutoff = totalTeams - Math.floor(totalTeams * 0.2) + 1;

  const bothTop4 = homeRank <= top4Cutoff && awayRank <= top4Cutoff;
  const bothTop8 = homeRank <= top8Cutoff && awayRank <= top8Cutoff;
  const bothBottom4 = homeRank >= bottom4Cutoff && awayRank >= bottom4Cutoff;
  const oneTop4 = homeRank <= top4Cutoff || awayRank <= top4Cutoff;
  const oneBottom4 = homeRank >= bottom4Cutoff || awayRank >= bottom4Cutoff;
  const oneTop6 = homeRank <= top6Cutoff || awayRank <= top6Cutoff;

  if (bothTop4) return 1.0;
  if (bothBottom4) return 0.8;
  if (bothTop8) return 0.6;
  if (oneTop4 && oneBottom4) return 0.5;
  if (oneTop6) return 0.3;
  return 0;
}

// ─── Post-game excitement calculation ───────────────────────────────────────

export function calculateFootballExcitement(
  match: FootballMatch,
  homeRank?: number,
  awayRank?: number,
  totalTeams?: number
): ExcitementResult {
  const goals = [...match.goals].sort((a, b) => a.minute - b.minute);
  const homeId = match.homeTeam.id;
  const totalGoals = match.homeScore + match.awayScore;
  const hasStats = match.homeStats != null && match.awayStats != null;

  let points = BASE_SCORE;
  points += totalGoalsPoints(totalGoals);
  points += closenessPoints(match.homeScore, match.awayScore);
  points += lateGoalsPoints(goals);
  points += leadChangesPoints(goals, homeId);
  points += redCardsPoints(match);
  points += comebackPoints(goals, homeId);
  points += lateEqualizerPoints(goals, homeId);

  if (hasStats) {
    points += shotIntensityPoints(match);
    points += shotsOnTargetPoints(match);
    points += possessionPoints(match);
    points += physicalPoints(match);
  }

  points += standingsBonus(homeRank, awayRank, totalTeams);
  points += knockoutBonus(match);

  const score = clampScore(points);
  return { score, label: getLabel(score) };
}

// ─── Pre-game prediction factor functions ───────────────────────────────────

function overUnderPoints(overUnder?: number): number {
  if (overUnder == null) return 0;
  if (overUnder <= 1.5) return -1.5;
  if (overUnder <= 2.0) return -0.5;
  if (overUnder <= 2.5) return 0;
  if (overUnder <= 3.0) return 0.8;
  if (overUnder <= 3.5) return 1.4;
  return 2.0; // 4.0+
}

function spreadClosenessPoints(spread?: number): number {
  if (spread == null) return 0;
  const abs = Math.abs(spread);
  if (abs <= 0.5) return 1.2;
  if (abs <= 1.0) return 0.6;
  if (abs <= 1.5) return 0;
  if (abs <= 2.0) return -0.5;
  return -1.2; // 2.5+
}

/** Convert American moneyline to implied probability (0-1). */
function moneylineToProb(ml: number): number {
  if (ml < 0) return Math.abs(ml) / (Math.abs(ml) + 100);
  return 100 / (ml + 100);
}

function moneylineBalancePoints(
  homeMl?: number,
  awayMl?: number,
  drawMl?: number
): number {
  // Need at least home and away moneyline to compute balance
  if (homeMl == null || awayMl == null) return 0;

  const probs: number[] = [moneylineToProb(homeMl), moneylineToProb(awayMl)];
  if (drawMl != null) {
    probs.push(moneylineToProb(drawMl));
  }

  // Normalize probabilities to sum to 1 (bookmaker vig removal)
  const total = probs.reduce((sum, p) => sum + p, 0);
  const normalized = probs.map((p) => p / total);

  // Standard deviation of normalized probabilities
  const mean = normalized.reduce((sum, p) => sum + p, 0) / normalized.length;
  const variance =
    normalized.reduce((sum, p) => sum + (p - mean) ** 2, 0) / normalized.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev <= 0.05) return 1.5;
  if (stdDev <= 0.10) return 0.9;
  if (stdDev <= 0.15) return 0.4;
  if (stdDev <= 0.20) return 0;
  if (stdDev <= 0.25) return -0.5;
  return -1.0; // heavy favorite
}

function predictionKnockoutBonus(
  isKnockout?: boolean,
  knockoutRound?: string
): number {
  if (!isKnockout) return 0;

  const stageBonuses: Record<string, number> = {
    "Knockout Round Playoffs": 0.5,
    "Rd of 16": 0.7,
    "Quarterfinals": 0.9,
    "Semifinals": 1.1,
    "Final": 1.3,
  };

  return stageBonuses[knockoutRound ?? ""] ?? 0.5;
}

// ─── Pre-game excitement prediction ─────────────────────────────────────────

export interface PredictionInput {
  odds: FootballOdds;
  homeRank?: number;
  awayRank?: number;
  totalTeams?: number;
  isKnockout?: boolean;
  knockoutRound?: string;
}

export function predictFootballExcitement(input: PredictionInput): ExcitementResult {
  const { odds, homeRank, awayRank, totalTeams, isKnockout, knockoutRound } = input;

  let points = PREDICTION_BASE_SCORE;
  points += overUnderPoints(odds.overUnder);
  points += spreadClosenessPoints(odds.spread);
  points += moneylineBalancePoints(odds.homeMoneyline, odds.awayMoneyline, odds.drawMoneyline);
  points += standingsBonus(homeRank, awayRank, totalTeams);
  points += predictionKnockoutBonus(isKnockout, knockoutRound);

  const score = clampScore(points);
  return { score, label: getLabel(score), predicted: true };
}

// ─── Easter egg detection (post-game only) ──────────────────────────────────

export function detectFootballEasterEggs(match: FootballMatch): EasterEgg[] {
  const eggs: EasterEgg[] = [];
  const goals = [...match.goals].sort((a, b) => a.minute - b.minute);
  const homeId = match.homeTeam.id;
  const totalGoals = match.homeScore + match.awayScore;
  const margin = Math.abs(match.homeScore - match.awayScore);

  // Cardiac Finish: goal at 85'+ AND final margin <= 1
  if (goals.some((g) => g.minute >= 85) && margin <= 1) {
    eggs.push({ id: "cardiac", emoji: "\u{1F493}", label: "Cardiac Finish", tooltip: "A late goal decided this tight game" });
  }

  // Rollercoaster: 2+ lead changes
  let homeScore = 0, awayScore = 0;
  let leader: "home" | "away" | "tie" = "tie";
  let leadChanges = 0;
  for (const goal of goals) {
    if (goal.teamId === homeId) homeScore++;
    else awayScore++;
    let newLeader: "home" | "away" | "tie";
    if (homeScore > awayScore) newLeader = "home";
    else if (awayScore > homeScore) newLeader = "away";
    else newLeader = "tie";
    if (newLeader !== "tie" && newLeader !== leader && leader !== "tie") leadChanges++;
    leader = newLeader;
  }
  if (leadChanges >= 2) {
    eggs.push({ id: "rollercoaster", emoji: "\u{1F3A2}", label: "Rollercoaster", tooltip: "The lead changed hands multiple times" });
  }

  // Goal Fest: 5+ total goals
  if (totalGoals >= 5) {
    eggs.push({ id: "goalfest", emoji: "\u{1F386}", label: "Goal Fest", tooltip: "A barrage of goals" });
  }

  // Defensive Battle: 0-1 total goals
  if (totalGoals <= 1) {
    eggs.push({ id: "defensive", emoji: "\u{1F6E1}\u{FE0F}", label: "Defensive Battle", tooltip: "A tightly contested defensive affair" });
  }

  // Comeback Trail: overcame 2+ goal deficit
  let hScore = 0, aScore = 0;
  let maxHomeDeficit = 0, maxAwayDeficit = 0;
  for (const goal of goals) {
    if (goal.teamId === homeId) hScore++;
    else aScore++;
    maxHomeDeficit = Math.max(maxHomeDeficit, aScore - hScore);
    maxAwayDeficit = Math.max(maxAwayDeficit, hScore - aScore);
  }
  const finalDiff = match.homeScore - match.awayScore;
  if ((maxHomeDeficit >= 2 && finalDiff >= 0) || (maxAwayDeficit >= 2 && finalDiff <= 0)) {
    eggs.push({ id: "comeback", emoji: "\u{1F525}", label: "Comeback Trail", tooltip: "A team fought back from 2+ goals down" });
  }

  // Seeing Red: 1+ red cards
  const reds = (match.cards || []).filter((c) => c.cardType === "red");
  if (reds.length >= 1) {
    eggs.push({ id: "red-card", emoji: "\u{1F7E5}", label: "Seeing Red", tooltip: "A red card shook things up" });
  }

  // Penalty Drama: any penalty goal
  if (goals.some((g) => g.isPenalty)) {
    eggs.push({ id: "penalty", emoji: "\u{1F945}", label: "Penalty Drama", tooltip: "A penalty kick featured in this match" });
  }

  // Physical Battle: 30+ fouls OR 2+ red cards
  const totalFouls = (match.homeStats?.foulsCommitted ?? 0) + (match.awayStats?.foulsCommitted ?? 0);
  if (totalFouls >= 30 || reds.length >= 2) {
    eggs.push({ id: "physical", emoji: "\u{1F4AA}", label: "Physical Battle", tooltip: "A bruising, physical encounter" });
  }

  return eggs;
}
