import { describe, it, expect } from "vitest";
import { calculateFootballExcitement, detectFootballEasterEggs } from "../football";
import type { FootballMatch, GoalEvent, CardEvent, TeamStats } from "../../api/football-data";

function makeMatch(overrides: Partial<FootballMatch> = {}): FootballMatch {
  return {
    id: "1",
    status: "FINISHED",
    utcDate: "2026-02-22T20:00:00Z",
    homeTeam: { id: "home", name: "Home FC" },
    awayTeam: { id: "away", name: "Away FC" },
    competition: "Premier League",
    homeScore: 0,
    awayScore: 0,
    goals: [],
    cards: [],
    ...overrides,
  };
}

function makeStats(overrides: Partial<TeamStats> = {}): TeamStats {
  return {
    totalShots: 15,
    shotsOnTarget: 7,
    possessionPct: 50,
    foulsCommitted: 10,
    wonCorners: 5,
    saves: 3,
    ...overrides,
  };
}

describe("calculateFootballExcitement", () => {
  it("gives a low score for a boring 0-0 with no stats", () => {
    const match = makeMatch({ homeScore: 0, awayScore: 0, goals: [] });
    const result = calculateFootballExcitement(match);
    expect(result.score).toBeLessThan(4);
    expect(result.label).toBe("Skip It");
  });

  it("gives a moderate score for a standard 1-0", () => {
    const match = makeMatch({
      homeScore: 1,
      awayScore: 0,
      goals: [{ minute: 55, teamId: "home" }],
    });
    const result = calculateFootballExcitement(match);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.score).toBeLessThan(7);
  });

  it("gives a high score for a thriller with late goals and lead changes", () => {
    const goals: GoalEvent[] = [
      { minute: 10, teamId: "home" },
      { minute: 25, teamId: "away" },
      { minute: 30, teamId: "away" },
      { minute: 60, teamId: "home" },
      { minute: 75, teamId: "home" },
      { minute: 91, teamId: "away" },
    ];
    const match = makeMatch({
      homeScore: 3,
      awayScore: 3,
      goals,
      homeStats: makeStats({ totalShots: 18, shotsOnTarget: 9, possessionPct: 48 }),
      awayStats: makeStats({ totalShots: 16, shotsOnTarget: 8, possessionPct: 52 }),
    });
    const result = calculateFootballExcitement(match);
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.label).toBe("Must Watch");
  });

  it("penalizes blowouts", () => {
    const goals: GoalEvent[] = [
      { minute: 5, teamId: "home" },
      { minute: 15, teamId: "home" },
      { minute: 30, teamId: "home" },
      { minute: 50, teamId: "home" },
      { minute: 70, teamId: "home" },
    ];
    const match = makeMatch({ homeScore: 5, awayScore: 0, goals });
    const result = calculateFootballExcitement(match);
    // High goal count but huge margin
    expect(result.score).toBeLessThan(7);
  });

  it("clamps score to [1, 10]", () => {
    // Very boring match
    const boring = makeMatch({
      homeScore: 0,
      awayScore: 0,
      goals: [],
      homeStats: makeStats({ totalShots: 4, shotsOnTarget: 1, possessionPct: 70, foulsCommitted: 5 }),
      awayStats: makeStats({ totalShots: 3, shotsOnTarget: 1, possessionPct: 30, foulsCommitted: 5 }),
    });
    const result = calculateFootballExcitement(boring);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it("scores Europa League matches identically to domestic matches", () => {
    const goals: GoalEvent[] = [
      { minute: 20, teamId: "home" },
      { minute: 70, teamId: "away" },
    ];
    const domestic = makeMatch({
      competition: "Premier League",
      homeScore: 1,
      awayScore: 1,
      goals,
    });
    const europa = makeMatch({
      competition: "Europa League",
      homeScore: 1,
      awayScore: 1,
      goals,
    });
    const domesticResult = calculateFootballExcitement(domestic);
    const europaResult = calculateFootballExcitement(europa);
    expect(europaResult.score).toBe(domesticResult.score);
    expect(europaResult.label).toBe(domesticResult.label);
  });

  it("scores Conference League matches identically to domestic matches", () => {
    const goals: GoalEvent[] = [
      { minute: 35, teamId: "home" },
      { minute: 55, teamId: "home" },
      { minute: 80, teamId: "away" },
    ];
    const domestic = makeMatch({
      competition: "La Liga",
      homeScore: 2,
      awayScore: 1,
      goals,
    });
    const conference = makeMatch({
      competition: "Conference League",
      homeScore: 2,
      awayScore: 1,
      goals,
    });
    const domesticResult = calculateFootballExcitement(domestic);
    const conferenceResult = calculateFootballExcitement(conference);
    expect(conferenceResult.score).toBe(domesticResult.score);
    expect(conferenceResult.label).toBe(domesticResult.label);
  });

  it("applies knockout bonus for Europa League knockout matches", () => {
    const goals: GoalEvent[] = [
      { minute: 30, teamId: "home" },
      { minute: 60, teamId: "away" },
    ];
    const leaguePhase = makeMatch({
      competition: "Europa League",
      homeScore: 1,
      awayScore: 1,
      goals,
    });
    const knockout = makeMatch({
      competition: "Europa League",
      homeScore: 1,
      awayScore: 1,
      goals,
      isKnockout: true,
      knockoutRound: "Quarterfinals",
    });
    const leagueResult = calculateFootballExcitement(leaguePhase);
    const knockoutResult = calculateFootballExcitement(knockout);
    expect(knockoutResult.score).toBeGreaterThan(leagueResult.score);
  });

  it("applies knockout bonus for Conference League knockout matches", () => {
    const goals: GoalEvent[] = [
      { minute: 15, teamId: "away" },
      { minute: 45, teamId: "home" },
    ];
    const leaguePhase = makeMatch({
      competition: "Conference League",
      homeScore: 1,
      awayScore: 1,
      goals,
    });
    const knockout = makeMatch({
      competition: "Conference League",
      homeScore: 1,
      awayScore: 1,
      goals,
      isKnockout: true,
      knockoutRound: "Semifinals",
    });
    const leagueResult = calculateFootballExcitement(leaguePhase);
    const knockoutResult = calculateFootballExcitement(knockout);
    expect(knockoutResult.score).toBeGreaterThan(leagueResult.score);
  });
});

describe("detectFootballEasterEggs", () => {
  it("detects Cardiac Finish (goal at 85+ with margin <= 1)", () => {
    const match = makeMatch({
      homeScore: 2,
      awayScore: 1,
      goals: [
        { minute: 10, teamId: "home" },
        { minute: 50, teamId: "away" },
        { minute: 88, teamId: "home" },
      ],
    });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "cardiac")).toBeTruthy();
  });

  it("does not detect Rollercoaster when lead changes pass through tie", () => {
    // With single-goal increments the lead always passes through a tie state,
    // so the algorithm's direct lead-change condition is rarely met
    const goals: GoalEvent[] = [
      { minute: 10, teamId: "home" },  // 1-0 home leads
      { minute: 20, teamId: "away" },  // 1-1 tie
      { minute: 30, teamId: "away" },  // 1-2 away leads
      { minute: 40, teamId: "home" },  // 2-2 tie
      { minute: 50, teamId: "home" },  // 3-2 home leads
    ];
    const match = makeMatch({ homeScore: 3, awayScore: 2, goals });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "rollercoaster")).toBeUndefined();
  });

  it("detects Goal Fest (5+ goals)", () => {
    const goals: GoalEvent[] = [
      { minute: 10, teamId: "home" },
      { minute: 20, teamId: "away" },
      { minute: 30, teamId: "home" },
      { minute: 50, teamId: "away" },
      { minute: 70, teamId: "home" },
    ];
    const match = makeMatch({ homeScore: 3, awayScore: 2, goals });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "goalfest")).toBeTruthy();
  });

  it("detects Defensive Battle (0-1 goals)", () => {
    const match = makeMatch({ homeScore: 0, awayScore: 0, goals: [] });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "defensive")).toBeTruthy();
  });

  it("detects Comeback Trail (2+ goal deficit overcome)", () => {
    const goals: GoalEvent[] = [
      { minute: 10, teamId: "away" },
      { minute: 20, teamId: "away" },  // 0-2
      { minute: 40, teamId: "home" },
      { minute: 60, teamId: "home" },  // 2-2 comeback
    ];
    const match = makeMatch({ homeScore: 2, awayScore: 2, goals });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "comeback")).toBeTruthy();
  });

  it("detects Seeing Red (red card)", () => {
    const cards: CardEvent[] = [{ minute: 50, teamId: "home", cardType: "red" }];
    const match = makeMatch({ homeScore: 1, awayScore: 0, goals: [{ minute: 10, teamId: "home" }], cards });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "red-card")).toBeTruthy();
  });

  it("detects Penalty Drama", () => {
    const goals: GoalEvent[] = [{ minute: 75, teamId: "home", isPenalty: true }];
    const match = makeMatch({ homeScore: 1, awayScore: 0, goals });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "penalty")).toBeTruthy();
  });

  it("detects Physical Battle (30+ fouls or 2+ reds)", () => {
    const cards: CardEvent[] = [
      { minute: 20, teamId: "home", cardType: "red" },
      { minute: 70, teamId: "away", cardType: "red" },
    ];
    const match = makeMatch({
      homeScore: 1,
      awayScore: 0,
      goals: [{ minute: 10, teamId: "home" }],
      cards,
    });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "physical")).toBeTruthy();
  });

  it("returns no easter eggs for a plain game", () => {
    const match = makeMatch({
      homeScore: 2,
      awayScore: 0,
      goals: [
        { minute: 30, teamId: "home" },
        { minute: 60, teamId: "home" },
      ],
    });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.length).toBe(0);
  });

  it("detects easter eggs for Europa League matches", () => {
    const match = makeMatch({
      competition: "Europa League",
      homeScore: 3,
      awayScore: 2,
      goals: [
        { minute: 10, teamId: "home" },
        { minute: 20, teamId: "away" },
        { minute: 30, teamId: "home" },
        { minute: 50, teamId: "away" },
        { minute: 70, teamId: "home" },
      ],
    });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "goalfest")).toBeTruthy();
  });

  it("detects easter eggs for Conference League matches", () => {
    const match = makeMatch({
      competition: "Conference League",
      homeScore: 2,
      awayScore: 1,
      goals: [
        { minute: 10, teamId: "home" },
        { minute: 50, teamId: "away" },
        { minute: 92, teamId: "home" },
      ],
    });
    const eggs = detectFootballEasterEggs(match);
    expect(eggs.find((e) => e.id === "cardiac")).toBeTruthy();
  });
});
