import { type F1EventData } from "../api/f1";
import { clampScore, getLabel, type ExcitementResult, type EasterEgg } from "./types";

const BASE_SCORE = 4.5;

// Top F1 constructors (2024-2025 era)
const TOP_TEAMS = new Set([
  "McLaren",
  "Red Bull",
  "Ferrari",
  "Mercedes",
]);

/**
 * Total position changes across the field (qual → race).
 * More shuffling = more exciting.
 */
function positionChangePoints(
  qualResults: { name: string }[],
  raceResults: { name: string }[]
): number {
  if (qualResults.length === 0 || raceResults.length === 0) return 0;

  const qualPositions = new Map<string, number>();
  qualResults.forEach((d, i) => qualPositions.set(d.name, i + 1));

  let totalChanges = 0;
  raceResults.forEach((d, i) => {
    const qualPos = qualPositions.get(d.name);
    if (qualPos != null) {
      totalChanges += Math.abs(qualPos - (i + 1));
    }
  });

  if (totalChanges >= 80) return 2.5;
  if (totalChanges >= 60) return 2.0;
  if (totalChanges >= 40) return 1.5;
  if (totalChanges >= 25) return 1.0;
  if (totalChanges >= 15) return 0.5;
  if (totalChanges < 8) return -0.5;
  return 0;
}

/**
 * Bonus when the race winner didn't start from pole.
 */
function winnerNotPolePoints(
  qualResults: { name: string }[],
  raceResults: { name: string }[]
): number {
  if (qualResults.length === 0 || raceResults.length === 0) return 0;
  const winner = raceResults[0]?.name;
  if (!winner) return 0;

  const qualPos = qualResults.findIndex((d) => d.name === winner) + 1;
  if (qualPos <= 0) return 0;

  if (qualPos >= 10) return 2.0;
  if (qualPos >= 5) return 1.5;
  if (qualPos >= 3) return 0.8;
  if (qualPos === 2) return 0.3;
  return 0; // pole sitter won — expected
}

/**
 * Bonus when top championship contenders fight at the front.
 */
function standingsBonus(
  raceResults: { name: string }[],
  standings?: Map<string, number>
): number {
  if (!standings || raceResults.length < 2) return 0;

  const p1Rank = standings.get(raceResults[0].name);
  const p2Rank = standings.get(raceResults[1].name);

  if (p1Rank != null && p2Rank != null && p1Rank <= 3 && p2Rank <= 3) return 0.8;
  if (p1Rank != null && p1Rank <= 5 && p2Rank != null && p2Rank <= 5) return 0.5;
  if (p1Rank != null && p1Rank <= 3) return 0.3;
  return 0;
}

/**
 * Bonus for underdog team winning or on podium.
 */
function underdogPoints(raceResults: { name: string; team?: string }[]): number {
  const podium = raceResults.slice(0, 3);
  const winner = podium[0];

  if (winner?.team && !TOP_TEAMS.has(winner.team)) return 1.5;

  const underdogOnPodium = podium.some(
    (d) => d.team && !TOP_TEAMS.has(d.team)
  );
  if (underdogOnPodium) return 0.5;

  return 0;
}

/**
 * Points for diverse teams in top positions (not dominated by one team).
 */
function teamDiversityPoints(
  raceResults: { team?: string }[]
): number {
  const top5Teams = raceResults
    .slice(0, 5)
    .map((d) => d.team)
    .filter(Boolean);
  const uniqueTeams = new Set(top5Teams).size;

  if (uniqueTeams >= 5) return 0.8;
  if (uniqueTeams >= 4) return 0.5;
  if (uniqueTeams >= 3) return 0.2;
  if (uniqueTeams <= 1) return -0.3;
  return 0;
}

export function calculateF1Excitement(
  event: F1EventData,
  standings?: Map<string, number>
): ExcitementResult {
  let points = BASE_SCORE;

  points += positionChangePoints(event.qualifyingResults, event.raceResults);
  points += winnerNotPolePoints(event.qualifyingResults, event.raceResults);
  points += standingsBonus(event.raceResults, standings);
  points += underdogPoints(event.raceResults);
  points += teamDiversityPoints(event.raceResults);

  const score = clampScore(points);
  return { score, label: getLabel(score) };
}

export function detectF1EasterEggs(event: F1EventData): EasterEgg[] {
  const eggs: EasterEgg[] = [];
  const { qualifyingResults, raceResults } = event;

  if (qualifyingResults.length === 0 || raceResults.length === 0) return eggs;

  // Giant Killer — non-top-team wins
  const winner = raceResults[0];
  if (winner?.team && !TOP_TEAMS.has(winner.team)) {
    eggs.push({
      id: "giant-killer",
      emoji: "🗡️",
      label: "Giant Killer",
      tooltip: `${winner.team} took the win`,
    });
  }

  // Grid Scramble — massive total position changes
  const qualPositions = new Map<string, number>();
  qualifyingResults.forEach((d, i) => qualPositions.set(d.name, i + 1));
  let totalChanges = 0;
  raceResults.forEach((d, i) => {
    const qualPos = qualPositions.get(d.name);
    if (qualPos != null) totalChanges += Math.abs(qualPos - (i + 1));
  });
  if (totalChanges >= 70) {
    eggs.push({
      id: "grid-scramble",
      emoji: "🔀",
      label: "Grid Scramble",
      tooltip: "Massive position changes from qualifying to race",
    });
  }

  // Processional — very few position changes
  if (totalChanges < 8) {
    eggs.push({
      id: "procession",
      emoji: "🚂",
      label: "Procession",
      tooltip: "Very few position changes throughout the race",
    });
  }

  // Comeback King — winner started P5 or lower
  if (winner) {
    const winnerQualPos =
      qualifyingResults.findIndex((d) => d.name === winner.name) + 1;
    if (winnerQualPos >= 5) {
      eggs.push({
        id: "comeback-king",
        emoji: "👑",
        label: "Comeback King",
        tooltip: `Winner started P${winnerQualPos}`,
      });
    }
  }

  // Team Diversity — 5 different teams in top 5
  const top5Teams = raceResults
    .slice(0, 5)
    .map((d) => d.team)
    .filter(Boolean);
  if (new Set(top5Teams).size >= 5) {
    eggs.push({
      id: "mixed-podium",
      emoji: "🌈",
      label: "All Different",
      tooltip: "5 different teams in the top 5",
    });
  }

  return eggs;
}

/**
 * Predict excitement for an upcoming race based on championship closeness
 * and qualifying results (if available).
 */
export function predictF1Excitement(opts: {
  qualifyingResults?: { name: string; team?: string }[];
  standings?: Map<string, number>;
}): ExcitementResult {
  let points = BASE_SCORE;

  // Championship closeness — having standings means there's a title fight to follow
  if (opts.standings && opts.standings.size >= 2) {
    points += 0.5;
  }

  if (opts.qualifyingResults && opts.qualifyingResults.length > 0) {
    // Diverse teams at the front = more likely competitive race
    const top5Teams = opts.qualifyingResults
      .slice(0, 5)
      .map((d) => d.team)
      .filter(Boolean);
    const uniqueTeams = new Set(top5Teams).size;
    if (uniqueTeams >= 5) points += 1.0;
    else if (uniqueTeams >= 4) points += 0.7;
    else if (uniqueTeams >= 3) points += 0.4;
    else if (uniqueTeams <= 1) points -= 0.3; // one team dominating

    // Championship contenders on the front row = spicy
    if (opts.standings) {
      const pole = opts.qualifyingResults[0];
      const p2 = opts.qualifyingResults[1];
      const poleRank = opts.standings.get(pole.name);
      const p2Rank = opts.standings.get(p2.name);

      if (poleRank != null && p2Rank != null && poleRank <= 3 && p2Rank <= 3) {
        points += 0.8; // title rivals starting 1-2
      } else if (poleRank != null && poleRank <= 3 && p2Rank != null && p2Rank <= 5) {
        points += 0.5;
      }

      // Championship leader not on pole = could produce drama
      const leaderOnPole = poleRank === 1;
      if (!leaderOnPole && poleRank != null) points += 0.3;
    }

    // Non-top-team on front row = potential surprise
    const poleTeam = opts.qualifyingResults[0]?.team;
    if (poleTeam && !TOP_TEAMS.has(poleTeam)) {
      points += 0.8;
    }
  }

  const score = clampScore(points);
  return { score, label: getLabel(score), predicted: true };
}
