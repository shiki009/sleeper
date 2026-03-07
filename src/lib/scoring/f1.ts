import { type F1EventData, type F1Driver } from "../api/f1";
import { clampScore, getLabel, type ExcitementResult, type EasterEgg } from "./types";

const BASE_SCORE = 4.5;

// Top F1 constructors (2024-2025 era)
const TOP_TEAMS = new Set([
  "McLaren",
  "Red Bull",
  "Ferrari",
  "Mercedes",
]);

// ─── Qualifying excitement ────────────────────────────────────────────

/**
 * Score qualifying based on how interesting the session was.
 * Factors: team diversity, underdog performance, championship contenders.
 */
export function calculateQualifyingExcitement(
  qualResults: F1Driver[],
  standings?: Map<string, number>
): ExcitementResult {
  if (qualResults.length === 0) {
    return { score: BASE_SCORE, label: getLabel(BASE_SCORE) };
  }

  let points = BASE_SCORE;

  // Team diversity in top 5 — mixed grid = exciting qualifying
  const top5Teams = qualResults.slice(0, 5).map((d) => d.team).filter(Boolean);
  const uniqueTeams = new Set(top5Teams).size;
  if (uniqueTeams >= 5) points += 1.2;
  else if (uniqueTeams >= 4) points += 0.8;
  else if (uniqueTeams >= 3) points += 0.4;
  else if (uniqueTeams <= 1) points -= 0.5;

  // Underdog on pole or front row
  const poleTeam = qualResults[0]?.team;
  if (poleTeam && !TOP_TEAMS.has(poleTeam)) {
    points += 1.5; // shock pole
  } else {
    const p2Team = qualResults[1]?.team;
    if (p2Team && !TOP_TEAMS.has(p2Team)) points += 0.8;
  }

  // Top 3 from 3 different teams
  const top3Teams = qualResults.slice(0, 3).map((d) => d.team).filter(Boolean);
  if (new Set(top3Teams).size >= 3) points += 0.5;

  // Championship contenders at the front
  if (standings) {
    const poleRank = standings.get(qualResults[0]?.name);
    const p2Rank = qualResults[1] ? standings.get(qualResults[1].name) : undefined;

    if (poleRank != null && p2Rank != null && poleRank <= 3 && p2Rank <= 3) {
      points += 0.8;
    } else if (poleRank != null && poleRank <= 3) {
      points += 0.3;
    }

    // Championship leader not on pole = drama
    const leaderName = Array.from(standings.entries()).find(([, rank]) => rank === 1)?.[0];
    if (leaderName && qualResults[0]?.name !== leaderName) {
      const leaderPos = qualResults.findIndex((d) => d.name === leaderName);
      if (leaderPos >= 5) points += 0.8;
      else if (leaderPos >= 2) points += 0.3;
    }
  }

  const score = clampScore(points);
  return { score, label: getLabel(score) };
}

export function detectQualifyingEasterEggs(
  qualResults: F1Driver[]
): EasterEgg[] {
  const eggs: EasterEgg[] = [];
  if (qualResults.length === 0) return eggs;

  // Shock Pole — non-top-team on pole
  const poleTeam = qualResults[0]?.team;
  if (poleTeam && !TOP_TEAMS.has(poleTeam)) {
    eggs.push({
      id: "shock-pole",
      emoji: "⚡",
      label: "Shock Pole",
      tooltip: `${qualResults[0].name} (${poleTeam}) took a surprise pole`,
    });
  }

  // All Different — 5 teams in top 5
  const top5Teams = qualResults.slice(0, 5).map((d) => d.team).filter(Boolean);
  if (new Set(top5Teams).size >= 5) {
    eggs.push({
      id: "mixed-grid",
      emoji: "🌈",
      label: "Mixed Grid",
      tooltip: "5 different teams in the top 5",
    });
  }

  return eggs;
}

// ─── Race excitement ──────────────────────────────────────────────────

function positionChangePoints(
  qualResults: F1Driver[],
  raceResults: F1Driver[]
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

function winnerNotPolePoints(
  qualResults: F1Driver[],
  raceResults: F1Driver[]
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
  return 0;
}

function standingsBonus(
  raceResults: F1Driver[],
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

function underdogPoints(raceResults: F1Driver[]): number {
  const podium = raceResults.slice(0, 3);
  const winner = podium[0];

  if (winner?.team && !TOP_TEAMS.has(winner.team)) return 1.5;
  if (podium.some((d) => d.team && !TOP_TEAMS.has(d.team))) return 0.5;
  return 0;
}

function teamDiversityPoints(raceResults: F1Driver[]): number {
  const top5Teams = raceResults.slice(0, 5).map((d) => d.team).filter(Boolean);
  const uniqueTeams = new Set(top5Teams).size;

  if (uniqueTeams >= 5) return 0.8;
  if (uniqueTeams >= 4) return 0.5;
  if (uniqueTeams >= 3) return 0.2;
  if (uniqueTeams <= 1) return -0.3;
  return 0;
}

export function calculateRaceExcitement(
  event: F1EventData,
  standings?: Map<string, number>
): ExcitementResult {
  const qualResults = event.qualifying?.results ?? [];
  const raceResults = event.race.results;

  let points = BASE_SCORE;
  points += positionChangePoints(qualResults, raceResults);
  points += winnerNotPolePoints(qualResults, raceResults);
  points += standingsBonus(raceResults, standings);
  points += underdogPoints(raceResults);
  points += teamDiversityPoints(raceResults);

  const score = clampScore(points);
  return { score, label: getLabel(score) };
}

export function detectRaceEasterEggs(event: F1EventData): EasterEgg[] {
  const eggs: EasterEgg[] = [];
  const qualResults = event.qualifying?.results ?? [];
  const raceResults = event.race.results;

  if (raceResults.length === 0) return eggs;

  const winner = raceResults[0];
  if (winner?.team && !TOP_TEAMS.has(winner.team)) {
    eggs.push({
      id: "giant-killer",
      emoji: "🗡️",
      label: "Giant Killer",
      tooltip: `${winner.team} took the win`,
    });
  }

  if (qualResults.length > 0) {
    const qualPositions = new Map<string, number>();
    qualResults.forEach((d, i) => qualPositions.set(d.name, i + 1));
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
    if (totalChanges < 8) {
      eggs.push({
        id: "procession",
        emoji: "🚂",
        label: "Procession",
        tooltip: "Very few position changes throughout the race",
      });
    }

    if (winner) {
      const winnerQualPos = qualResults.findIndex((d) => d.name === winner.name) + 1;
      if (winnerQualPos >= 5) {
        eggs.push({
          id: "comeback-king",
          emoji: "👑",
          label: "Comeback King",
          tooltip: `Winner started P${winnerQualPos}`,
        });
      }
    }
  }

  const top5Teams = raceResults.slice(0, 5).map((d) => d.team).filter(Boolean);
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

// ─── Race prediction ──────────────────────────────────────────────────

export function predictRaceExcitement(opts: {
  qualifyingResults?: F1Driver[];
  standings?: Map<string, number>;
}): ExcitementResult {
  let points = BASE_SCORE;

  if (opts.standings && opts.standings.size >= 2) {
    points += 0.5;
  }

  if (opts.qualifyingResults && opts.qualifyingResults.length > 0) {
    const top5Teams = opts.qualifyingResults
      .slice(0, 5)
      .map((d) => d.team)
      .filter(Boolean);
    const uniqueTeams = new Set(top5Teams).size;
    if (uniqueTeams >= 5) points += 1.0;
    else if (uniqueTeams >= 4) points += 0.7;
    else if (uniqueTeams >= 3) points += 0.4;
    else if (uniqueTeams <= 1) points -= 0.3;

    if (opts.standings) {
      const pole = opts.qualifyingResults[0];
      const p2 = opts.qualifyingResults[1];
      const poleRank = pole ? opts.standings.get(pole.name) : undefined;
      const p2Rank = p2 ? opts.standings.get(p2.name) : undefined;

      if (poleRank != null && p2Rank != null && poleRank <= 3 && p2Rank <= 3) {
        points += 0.8;
      } else if (poleRank != null && poleRank <= 3 && p2Rank != null && p2Rank <= 5) {
        points += 0.5;
      }

      const leaderOnPole = poleRank === 1;
      if (!leaderOnPole && poleRank != null) points += 0.3;
    }

    const poleTeam = opts.qualifyingResults[0]?.team;
    if (poleTeam && !TOP_TEAMS.has(poleTeam)) {
      points += 0.8;
    }
  }

  const score = clampScore(points);
  return { score, label: getLabel(score), predicted: true };
}
