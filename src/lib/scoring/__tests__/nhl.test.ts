import { describe, it, expect } from "vitest";
import { calculateNhlExcitement, detectNhlEasterEggs, predictNhlExcitement } from "../nhl";
import type { NhlGameData, NhlGoal, NhlTeamStats, NhlOdds } from "../../api/nhl";
import type { NhlPredictionInput } from "../nhl";

function makeNhlGame(overrides: Partial<NhlGameData> = {}): NhlGameData {
  return {
    id: "1",
    homeTeam: { id: "home", name: "Home", score: 3 },
    awayTeam: { id: "away", name: "Away", score: 2 },
    status: "STATUS_FINAL",
    period: 3,
    date: "2026-02-22T00:00:00Z",
    goals: [],
    ...overrides,
  };
}

function makeStats(overrides: Partial<NhlTeamStats> = {}): NhlTeamStats {
  return {
    shotsTotal: 30,
    hits: 20,
    blockedShots: 15,
    powerPlayGoals: 1,
    powerPlayOpportunities: 3,
    shortHandedGoals: 0,
    shootoutGoals: 0,
    penalties: 3,
    penaltyMinutes: 6,
    takeaways: 5,
    giveaways: 8,
    faceoffPercent: 50,
    ...overrides,
  };
}

describe("calculateNhlExcitement", () => {
  it("gives a low score for a boring 1-0 game", () => {
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 1 },
      awayTeam: { id: "away", name: "Away", score: 0 },
      goals: [{ period: 1, clock: "10:00", teamId: "home", text: "", homeScore: 1, awayScore: 0 }],
      homeStats: makeStats({ shotsTotal: 20, hits: 15 }),
      awayStats: makeStats({ shotsTotal: 18, hits: 15 }),
    });
    const result = calculateNhlExcitement(game);
    expect(result.score).toBeLessThan(5);
  });

  it("gives a high score for an OT thriller with lead changes", () => {
    const goals: NhlGoal[] = [
      { period: 1, clock: "15:00", teamId: "home", text: "", homeScore: 1, awayScore: 0 },
      { period: 1, clock: "8:00", teamId: "away", text: "", homeScore: 1, awayScore: 1 },
      { period: 2, clock: "10:00", teamId: "away", text: "", homeScore: 1, awayScore: 2 },
      { period: 2, clock: "5:00", teamId: "home", text: "", homeScore: 2, awayScore: 2 },
      { period: 3, clock: "3:00", teamId: "away", text: "", homeScore: 2, awayScore: 3 },
      { period: 3, clock: "1:30", teamId: "home", text: "", homeScore: 3, awayScore: 3 },
      { period: 4, clock: "2:00", teamId: "home", text: "", homeScore: 4, awayScore: 3 },
    ];
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 4 },
      awayTeam: { id: "away", name: "Away", score: 3 },
      period: 4,
      goals,
      homeStats: makeStats({ shotsTotal: 38, hits: 28 }),
      awayStats: makeStats({ shotsTotal: 35, hits: 25 }),
    });
    const result = calculateNhlExcitement(game);
    expect(result.score).toBeGreaterThanOrEqual(7);
  });

  it("rewards shootout games", () => {
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 3 },
      awayTeam: { id: "away", name: "Away", score: 2 },
      period: 5,
      goals: [
        { period: 1, clock: "10:00", teamId: "home", text: "", homeScore: 1, awayScore: 0 },
        { period: 2, clock: "10:00", teamId: "away", text: "", homeScore: 1, awayScore: 1 },
        { period: 3, clock: "5:00", teamId: "away", text: "", homeScore: 1, awayScore: 2 },
        { period: 3, clock: "2:00", teamId: "home", text: "", homeScore: 2, awayScore: 2 },
      ],
      homeStats: makeStats({ shootoutGoals: 2, shotsTotal: 32, hits: 22 }),
      awayStats: makeStats({ shootoutGoals: 1, shotsTotal: 28, hits: 20 }),
    });
    const result = calculateNhlExcitement(game);
    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  it("clamps score to [1, 10]", () => {
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 0 },
      awayTeam: { id: "away", name: "Away", score: 6 },
      goals: [],
      homeStats: makeStats({ shotsTotal: 15, hits: 10 }),
      awayStats: makeStats({ shotsTotal: 40, hits: 30 }),
    });
    const result = calculateNhlExcitement(game);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
  });
});

describe("detectNhlEasterEggs", () => {
  it("detects Cardiac Finish (late 3rd period goal, 1-goal margin)", () => {
    const goals: NhlGoal[] = [
      { period: 3, clock: "1:30", teamId: "home", text: "", homeScore: 2, awayScore: 1 },
    ];
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 2 },
      awayTeam: { id: "away", name: "Away", score: 1 },
      goals,
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.find((e) => e.id === "cardiac")).toBeTruthy();
  });

  it("detects Rollercoaster (3+ lead changes)", () => {
    // Use cumulative scores that skip the tie state to trigger direct lead changes
    const goals: NhlGoal[] = [
      { period: 1, clock: "15:00", teamId: "home", text: "", homeScore: 1, awayScore: 0 }, // home leads, from tie → no count
      { period: 1, clock: "10:00", teamId: "away", text: "", homeScore: 1, awayScore: 2 }, // away leads, from home → count 1
      { period: 2, clock: "10:00", teamId: "home", text: "", homeScore: 3, awayScore: 2 }, // home leads, from away → count 2
      { period: 3, clock: "5:00", teamId: "away", text: "", homeScore: 3, awayScore: 4 },  // away leads, from home → count 3
    ];
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 3 },
      awayTeam: { id: "away", name: "Away", score: 4 },
      goals,
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.find((e) => e.id === "rollercoaster")).toBeTruthy();
  });

  it("detects Goal Fest (8+ goals)", () => {
    const goals: NhlGoal[] = Array.from({ length: 8 }, (_, i) => ({
      period: Math.floor(i / 3) + 1,
      clock: "10:00",
      teamId: i % 2 === 0 ? "home" : "away",
      text: "",
      homeScore: Math.ceil((i + 1) / 2),
      awayScore: Math.floor((i + 1) / 2),
    }));
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 4 },
      awayTeam: { id: "away", name: "Away", score: 4 },
      goals,
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.find((e) => e.id === "goalfest")).toBeTruthy();
  });

  it("detects Defensive Battle (0-2 goals)", () => {
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 1 },
      awayTeam: { id: "away", name: "Away", score: 0 },
      goals: [{ period: 2, clock: "10:00", teamId: "home", text: "", homeScore: 1, awayScore: 0 }],
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.find((e) => e.id === "defensive")).toBeTruthy();
  });

  it("detects Free Hockey! (OT)", () => {
    const game = makeNhlGame({
      period: 4,
      goals: [
        { period: 4, clock: "3:00", teamId: "home", text: "", homeScore: 3, awayScore: 2 },
      ],
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.find((e) => e.id === "ot")).toBeTruthy();
  });

  it("detects Shootout", () => {
    const game = makeNhlGame({
      homeStats: makeStats({ shootoutGoals: 2 }),
      awayStats: makeStats({ shootoutGoals: 1 }),
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.find((e) => e.id === "shootout")).toBeTruthy();
  });

  it("detects Comeback Trail (2+ goal deficit overcome)", () => {
    const goals: NhlGoal[] = [
      { period: 1, clock: "15:00", teamId: "away", text: "", homeScore: 0, awayScore: 1 },
      { period: 1, clock: "10:00", teamId: "away", text: "", homeScore: 0, awayScore: 2 },
      { period: 2, clock: "15:00", teamId: "home", text: "", homeScore: 1, awayScore: 2 },
      { period: 3, clock: "10:00", teamId: "home", text: "", homeScore: 2, awayScore: 2 },
      { period: 3, clock: "5:00", teamId: "home", text: "", homeScore: 3, awayScore: 2 },
    ];
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 3 },
      awayTeam: { id: "away", name: "Away", score: 2 },
      goals,
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.find((e) => e.id === "comeback")).toBeTruthy();
  });

  it("detects Short-Handed Hero", () => {
    const game = makeNhlGame({
      homeStats: makeStats({ shortHandedGoals: 1 }),
      awayStats: makeStats({ shortHandedGoals: 0 }),
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.find((e) => e.id === "shorthanded")).toBeTruthy();
  });

  it("detects Physical Battle (60+ hits or 30+ PIM)", () => {
    const game = makeNhlGame({
      homeStats: makeStats({ hits: 35, penaltyMinutes: 10 }),
      awayStats: makeStats({ hits: 30, penaltyMinutes: 8 }),
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.find((e) => e.id === "physical")).toBeTruthy();
  });

  it("returns no easter eggs for a plain game", () => {
    const goals: NhlGoal[] = [
      { period: 1, clock: "15:00", teamId: "home", text: "", homeScore: 1, awayScore: 0 },
      { period: 2, clock: "10:00", teamId: "home", text: "", homeScore: 2, awayScore: 0 },
      { period: 2, clock: "5:00", teamId: "home", text: "", homeScore: 3, awayScore: 0 },
    ];
    const game = makeNhlGame({
      homeTeam: { id: "home", name: "Home", score: 3 },
      awayTeam: { id: "away", name: "Away", score: 0 },
      period: 3,
      goals,
      homeStats: makeStats({ hits: 20, penaltyMinutes: 8, shootoutGoals: 0, shortHandedGoals: 0 }),
      awayStats: makeStats({ hits: 18, penaltyMinutes: 6, shootoutGoals: 0, shortHandedGoals: 0 }),
    });
    const eggs = detectNhlEasterEggs(game);
    expect(eggs.length).toBe(0);
  });
});

function makeOdds(overrides: Partial<NhlOdds> = {}): NhlOdds {
  return {
    overUnder: 6.0,
    spread: 1.5,
    homeMoneyline: -150,
    awayMoneyline: +130,
    ...overrides,
  };
}

function makePredictionInput(overrides: Partial<NhlPredictionInput> = {}): NhlPredictionInput {
  return {
    odds: makeOdds(),
    ...overrides,
  };
}

describe("predictNhlExcitement", () => {
  it("returns a result with predicted: true", () => {
    const result = predictNhlExcitement(makePredictionInput());
    expect(result.predicted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(typeof result.label).toBe("string");
  });

  it("gives a higher score for high over/under and tight spread", () => {
    const exciting = predictNhlExcitement(
      makePredictionInput({
        odds: makeOdds({ overUnder: 7.5, spread: 0.5 }),
      })
    );
    const boring = predictNhlExcitement(
      makePredictionInput({
        odds: makeOdds({ overUnder: 4.0, spread: 3.0 }),
      })
    );
    expect(exciting.score).toBeGreaterThan(boring.score);
  });

  it("gives a higher score for balanced moneylines", () => {
    const balanced = predictNhlExcitement(
      makePredictionInput({
        odds: makeOdds({ homeMoneyline: -110, awayMoneyline: -110 }),
      })
    );
    const lopsided = predictNhlExcitement(
      makePredictionInput({
        odds: makeOdds({ homeMoneyline: -500, awayMoneyline: +400 }),
      })
    );
    expect(balanced.score).toBeGreaterThan(lopsided.score);
  });

  it("adds standings bonus when both teams are top-ranked", () => {
    const without = predictNhlExcitement(makePredictionInput());
    const with_ = predictNhlExcitement(
      makePredictionInput({ homeRank: 1, awayRank: 2 })
    );
    expect(with_.score).toBeGreaterThan(without.score);
  });

  it("handles missing odds fields gracefully", () => {
    const result = predictNhlExcitement(
      makePredictionInput({
        odds: { overUnder: undefined, spread: undefined, homeMoneyline: undefined, awayMoneyline: undefined },
      })
    );
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.predicted).toBe(true);
  });

  it("does not set predicted flag on post-game calculateNhlExcitement", () => {
    const game = makeNhlGame();
    const result = calculateNhlExcitement(game);
    expect(result.predicted).toBeUndefined();
  });

  it("clamps extreme scores", () => {
    const high = predictNhlExcitement(
      makePredictionInput({
        odds: makeOdds({ spread: 0, overUnder: 8.0, homeMoneyline: -110, awayMoneyline: -110 }),
        homeRank: 1,
        awayRank: 2,
      })
    );
    expect(high.score).toBeLessThanOrEqual(10);

    const low = predictNhlExcitement(
      makePredictionInput({
        odds: makeOdds({ spread: 4, overUnder: 3.5, homeMoneyline: -800, awayMoneyline: +500 }),
      })
    );
    expect(low.score).toBeGreaterThanOrEqual(1);
  });
});
