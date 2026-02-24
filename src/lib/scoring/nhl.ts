import { type NhlGameData } from "../api/nhl";
import { clampScore, getLabel, type ExcitementResult, type EasterEgg } from "./types";

const BASE_SCORE = 4.0;

function totalGoalsPoints(total: number): number {
  if (total <= 1) return -1.0;
  if (total <= 3) return 0;
  if (total <= 5) return 0.5;
  return 1.0; // 6+
}

function closenessPoints(game: NhlGameData): number {
  const diff = Math.abs(game.homeTeam.score - game.awayTeam.score);
  // Note: OT/SO games always end with 1-goal diff, handled by overtimePoints
  if (diff === 0) return 0.5;
  if (diff === 1) return 0.3;
  if (diff === 2) return 0;
  if (diff === 3) return -0.3;
  return -0.8;
}

function leadChangesPoints(game: NhlGameData): number {
  let leader: "home" | "away" | "tie" = "tie";
  let changes = 0;

  for (const goal of game.goals) {
    let newLeader: "home" | "away" | "tie";
    if (goal.homeScore > goal.awayScore) newLeader = "home";
    else if (goal.awayScore > goal.homeScore) newLeader = "away";
    else newLeader = "tie";

    if (newLeader !== "tie" && newLeader !== leader && leader !== "tie") {
      changes++;
    }
    leader = newLeader;
  }

  if (changes === 0) return 0;
  if (changes === 1) return 0.5;
  if (changes === 2) return 1.0;
  return 1.2; // 3+
}

function overtimePoints(game: NhlGameData): number {
  const homeShootout = game.homeStats?.shootoutGoals ?? 0;
  const awayShootout = game.awayStats?.shootoutGoals ?? 0;
  if (homeShootout > 0 || awayShootout > 0) return 1.5;
  if (game.period > 3) return 1.2;
  if (game.goals.some((g) => g.period > 3)) return 1.2;
  return 0;
}

function thirdPeriodGoalsPoints(game: NhlGameData): number {
  const p3Goals = game.goals.filter((g) => g.period === 3);
  return Math.min(0.6, p3Goals.length * 0.2);
}

function specialTeamsPoints(game: NhlGameData): number {
  const homePP = game.homeStats?.powerPlayGoals ?? 0;
  const awayPP = game.awayStats?.powerPlayGoals ?? 0;
  const homeSH = game.homeStats?.shortHandedGoals ?? 0;
  const awaySH = game.awayStats?.shortHandedGoals ?? 0;
  const total = homePP + awayPP + homeSH + awaySH;
  return Math.min(0.6, total * 0.2);
}

function comebackPoints(game: NhlGameData): number {
  let maxHomeDeficit = 0;
  let maxAwayDeficit = 0;

  for (const goal of game.goals) {
    const diff = goal.homeScore - goal.awayScore;
    if (diff < 0) maxHomeDeficit = Math.max(maxHomeDeficit, -diff);
    if (diff > 0) maxAwayDeficit = Math.max(maxAwayDeficit, diff);
  }

  const finalDiff = game.homeTeam.score - game.awayTeam.score;
  if (maxHomeDeficit >= 2 && finalDiff >= 0) return 1.5;
  if (maxAwayDeficit >= 2 && finalDiff <= 0) return 1.5;
  return 0;
}

function shotIntensityPoints(game: NhlGameData): number {
  const home = game.homeStats?.shotsTotal ?? 0;
  const away = game.awayStats?.shotsTotal ?? 0;
  const total = home + away;
  if (total >= 70) return 0.3;
  if (total >= 60) return 0.15;
  if (total >= 50) return 0;
  if (total >= 40) return -0.1;
  return -0.2;
}

function physicalityPoints(game: NhlGameData): number {
  const homeHits = game.homeStats?.hits ?? 0;
  const awayHits = game.awayStats?.hits ?? 0;
  const total = homeHits + awayHits;
  if (total >= 50) return 0.3;
  if (total >= 40) return 0.15;
  if (total >= 30) return 0;
  return -0.1;
}

function standingsBonus(homeRank?: number, awayRank?: number): number {
  if (homeRank == null || awayRank == null) return 0;
  const bothTop5 = homeRank <= 5 && awayRank <= 5;
  const bothTop16 = homeRank <= 16 && awayRank <= 16;
  const oneTop5 = homeRank <= 5 || awayRank <= 5;

  if (bothTop5) return 1.0;
  if (bothTop16) return 0.5;
  if (oneTop5) return 0.3;
  return 0;
}

export function calculateNhlExcitement(
  game: NhlGameData,
  homeRank?: number,
  awayRank?: number
): ExcitementResult {
  let points = BASE_SCORE;

  points += totalGoalsPoints(game.homeTeam.score + game.awayTeam.score);
  points += closenessPoints(game);
  points += leadChangesPoints(game);
  points += overtimePoints(game);
  points += thirdPeriodGoalsPoints(game);
  points += specialTeamsPoints(game);
  points += comebackPoints(game);
  points += shotIntensityPoints(game);
  points += physicalityPoints(game);
  points += standingsBonus(homeRank, awayRank);

  const score = clampScore(points);
  return { score, label: getLabel(score) };
}

export function detectNhlEasterEggs(game: NhlGameData): EasterEgg[] {
  const eggs: EasterEgg[] = [];
  const totalGoals = game.homeTeam.score + game.awayTeam.score;
  const margin = Math.abs(game.homeTeam.score - game.awayTeam.score);

  // Cardiac Finish: 3rd period goal with <2min left AND margin=1
  const lateP3Goals = game.goals.filter((g) => {
    if (g.period !== 3) return false;
    // Clock is in "MM:SS" format, parse to seconds
    const parts = g.clock.split(":");
    const secs = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
    return secs <= 120;
  });
  if (lateP3Goals.length > 0 && margin === 1) {
    eggs.push({ id: "cardiac", emoji: "\u{1F493}", label: "Cardiac Finish", tooltip: "A late 3rd period goal decided this one-goal game" });
  }

  // Rollercoaster: 3+ lead changes
  let leader: "home" | "away" | "tie" = "tie";
  let leadChanges = 0;
  for (const goal of game.goals) {
    let newLeader: "home" | "away" | "tie";
    if (goal.homeScore > goal.awayScore) newLeader = "home";
    else if (goal.awayScore > goal.homeScore) newLeader = "away";
    else newLeader = "tie";
    if (newLeader !== "tie" && newLeader !== leader && leader !== "tie") leadChanges++;
    leader = newLeader;
  }
  if (leadChanges >= 3) {
    eggs.push({ id: "rollercoaster", emoji: "\u{1F3A2}", label: "Rollercoaster", tooltip: "The lead changed hands 3+ times" });
  }

  // Goal Fest: 8+ total goals
  if (totalGoals >= 8) {
    eggs.push({ id: "goalfest", emoji: "\u{1F386}", label: "Goal Fest", tooltip: "Goals flying in from all directions" });
  }

  // Defensive Battle: 0-2 total goals
  if (totalGoals <= 2) {
    eggs.push({ id: "defensive", emoji: "\u{1F6E1}\u{FE0F}", label: "Defensive Battle", tooltip: "A tight, defensive chess match" });
  }

  // Free Hockey!: OT (period > 3)
  const hasOT = game.period > 3 || game.goals.some((g) => g.period > 3);
  if (hasOT) {
    eggs.push({ id: "ot", emoji: "\u{1F389}", label: "Free Hockey!", tooltip: "This game went to overtime" });
  }

  // Shootout: shootoutGoals > 0
  const homeShootout = game.homeStats?.shootoutGoals ?? 0;
  const awayShootout = game.awayStats?.shootoutGoals ?? 0;
  if (homeShootout > 0 || awayShootout > 0) {
    eggs.push({ id: "shootout", emoji: "\u{1F3AF}", label: "Shootout", tooltip: "This game went all the way to a shootout" });
  }

  // Comeback Trail: overcame 2+ goal deficit
  let maxHomeDeficit = 0, maxAwayDeficit = 0;
  for (const goal of game.goals) {
    const diff = goal.homeScore - goal.awayScore;
    if (diff < 0) maxHomeDeficit = Math.max(maxHomeDeficit, -diff);
    if (diff > 0) maxAwayDeficit = Math.max(maxAwayDeficit, diff);
  }
  const finalDiff = game.homeTeam.score - game.awayTeam.score;
  if ((maxHomeDeficit >= 2 && finalDiff >= 0) || (maxAwayDeficit >= 2 && finalDiff <= 0)) {
    eggs.push({ id: "comeback", emoji: "\u{1F525}", label: "Comeback Trail", tooltip: "A team came back from 2+ goals down" });
  }

  // Short-Handed Hero: any short-handed goal
  const homeSH = game.homeStats?.shortHandedGoals ?? 0;
  const awaySH = game.awayStats?.shortHandedGoals ?? 0;
  if (homeSH > 0 || awaySH > 0) {
    eggs.push({ id: "shorthanded", emoji: "\u{1F9B8}", label: "Short-Handed Hero", tooltip: "A rare short-handed goal was scored" });
  }

  // Physical Battle: 60+ hits OR 30+ penalty minutes
  const totalHits = (game.homeStats?.hits ?? 0) + (game.awayStats?.hits ?? 0);
  const totalPIM = (game.homeStats?.penaltyMinutes ?? 0) + (game.awayStats?.penaltyMinutes ?? 0);
  if (totalHits >= 60 || totalPIM >= 30) {
    eggs.push({ id: "physical", emoji: "\u{1F4AA}", label: "Physical Battle", tooltip: "A hard-hitting, physical game" });
  }

  return eggs;
}
