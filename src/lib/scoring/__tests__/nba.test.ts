import { describe, it, expect } from "vitest";
import { calculateNbaExcitement, detectNbaEasterEggs, predictNbaExcitement } from "../nba";
import type { NbaGameData, NbaPlay, NbaTeamStats, NbaOdds } from "../../api/nba";
import type { NbaPredictionInput } from "../nba";

function makeNbaGame(overrides: Partial<NbaGameData> = {}): NbaGameData {
  return {
    id: "1",
    homeTeam: { name: "Home", score: 100 },
    awayTeam: { name: "Away", score: 95 },
    status: "STATUS_FINAL",
    period: 4,
    date: "2026-02-22T00:00:00Z",
    plays: [],
    ...overrides,
  };
}

function makeStats(overrides: Partial<NbaTeamStats> = {}): NbaTeamStats {
  return {
    leadChanges: 8,
    largestLead: 10,
    fastBreakPoints: 12,
    pointsInPaint: 40,
    turnovers: 12,
    totalTurnovers: 15,
    fouls: 18,
    technicalFouls: 0,
    ...overrides,
  };
}

describe("calculateNbaExcitement", () => {
  it("gives a low score for a blowout", () => {
    const game = makeNbaGame({
      homeTeam: { name: "Home", score: 130 },
      awayTeam: { name: "Away", score: 90 },
    });
    const result = calculateNbaExcitement(game);
    expect(result.score).toBeLessThan(5);
  });

  it("gives a high score for a close OT game", () => {
    const plays: NbaPlay[] = [
      { period: 4, clock: "0:45", clockValue: 45, homeScore: 100, awayScore: 101, scoringPlay: true },
      { period: 4, clock: "0:10", clockValue: 10, homeScore: 102, awayScore: 101, scoringPlay: true },
    ];
    const game = makeNbaGame({
      homeTeam: { name: "Home", score: 112 },
      awayTeam: { name: "Away", score: 110 },
      period: 5, // OT
      plays,
      homeStats: makeStats({ leadChanges: 18 }),
      awayStats: makeStats({ leadChanges: 18 }),
      winProbSwings: 12,
    });
    const result = calculateNbaExcitement(game);
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.label).toBe("Must Watch");
  });

  it("rewards high-scoring games", () => {
    const game = makeNbaGame({
      homeTeam: { name: "Home", score: 140 },
      awayTeam: { name: "Away", score: 135 },
    });
    const result = calculateNbaExcitement(game);
    // Close margin + high total
    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  it("clamps score to [1, 10]", () => {
    const game = makeNbaGame({
      homeTeam: { name: "Home", score: 70 },
      awayTeam: { name: "Away", score: 120 },
    });
    const result = calculateNbaExcitement(game);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
  });
});

describe("detectNbaEasterEggs", () => {
  it("detects Cardiac Finish (within 3 pts in final 60s of Q4)", () => {
    const plays: NbaPlay[] = [
      { period: 4, clock: "0:30", clockValue: 30, homeScore: 99, awayScore: 100, scoringPlay: false },
    ];
    const game = makeNbaGame({ plays });
    const eggs = detectNbaEasterEggs(game);
    expect(eggs.find((e) => e.id === "cardiac")).toBeTruthy();
  });

  it("detects Rollercoaster (16+ lead changes)", () => {
    const game = makeNbaGame({
      homeStats: makeStats({ leadChanges: 20 }),
      awayStats: makeStats({ leadChanges: 20 }),
    });
    const eggs = detectNbaEasterEggs(game);
    expect(eggs.find((e) => e.id === "rollercoaster")).toBeTruthy();
  });

  it("detects Drama Alert (15+ win prob swings)", () => {
    const game = makeNbaGame({ winProbSwings: 18 });
    const eggs = detectNbaEasterEggs(game);
    expect(eggs.find((e) => e.id === "drama")).toBeTruthy();
  });

  it("detects Offensive Explosion (270+ total points)", () => {
    const game = makeNbaGame({
      homeTeam: { name: "Home", score: 140 },
      awayTeam: { name: "Away", score: 135 },
    });
    const eggs = detectNbaEasterEggs(game);
    expect(eggs.find((e) => e.id === "offensive")).toBeTruthy();
  });

  it("detects Defensive Battle (170 or fewer)", () => {
    const game = makeNbaGame({
      homeTeam: { name: "Home", score: 82 },
      awayTeam: { name: "Away", score: 78 },
    });
    const eggs = detectNbaEasterEggs(game);
    expect(eggs.find((e) => e.id === "defensive")).toBeTruthy();
  });

  it("detects Extra Time (OT)", () => {
    const game = makeNbaGame({ period: 5 });
    const eggs = detectNbaEasterEggs(game);
    expect(eggs.find((e) => e.id === "overtime")).toBeTruthy();
  });

  it("detects Comeback Trail (15+ point deficit overcome)", () => {
    const game = makeNbaGame({
      homeTeam: { name: "Home", score: 105 },
      awayTeam: { name: "Away", score: 100 },
      homeStats: makeStats({ largestLead: 5 }),
      awayStats: makeStats({ largestLead: 18 }),
    });
    const eggs = detectNbaEasterEggs(game);
    expect(eggs.find((e) => e.id === "comeback")).toBeTruthy();
  });

  it("returns no easter eggs for a plain game", () => {
    const game = makeNbaGame({
      homeTeam: { name: "Home", score: 105 },
      awayTeam: { name: "Away", score: 95 },
      period: 4,
      plays: [],
      homeStats: makeStats({ leadChanges: 5, largestLead: 10 }),
      awayStats: makeStats({ leadChanges: 5, largestLead: 8 }),
      winProbSwings: 3,
    });
    const eggs = detectNbaEasterEggs(game);
    expect(eggs.length).toBe(0);
  });
});

// ─── Prediction helpers ─────────────────────────────────────────────────────

function makeOdds(overrides: Partial<NbaOdds> = {}): NbaOdds {
  return {
    overUnder: 220,
    spread: 5,
    homeMoneyline: -200,
    awayMoneyline: +170,
    ...overrides,
  };
}

function makePredictionInput(overrides: Partial<NbaPredictionInput> = {}): NbaPredictionInput {
  return {
    odds: makeOdds(),
    ...overrides,
  };
}

describe("predictNbaExcitement", () => {
  it("returns a result with predicted: true", () => {
    const result = predictNbaExcitement(makePredictionInput());
    expect(result.predicted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(typeof result.label).toBe("string");
  });

  it("gives a higher score for tight spread and balanced moneylines", () => {
    const exciting = predictNbaExcitement(
      makePredictionInput({
        odds: makeOdds({ spread: 1, homeMoneyline: -110, awayMoneyline: -110 }),
      })
    );
    const boring = predictNbaExcitement(
      makePredictionInput({
        odds: makeOdds({ spread: 15, homeMoneyline: -800, awayMoneyline: +500 }),
      })
    );
    expect(exciting.score).toBeGreaterThan(boring.score);
  });

  it("adds standings bonus when both teams are top-ranked", () => {
    const without = predictNbaExcitement(makePredictionInput());
    const with_ = predictNbaExcitement(
      makePredictionInput({ homeRank: 1, awayRank: 2 })
    );
    expect(with_.score).toBeGreaterThan(without.score);
  });

  it("handles missing odds fields gracefully", () => {
    const result = predictNbaExcitement(
      makePredictionInput({
        odds: { overUnder: undefined, spread: undefined, homeMoneyline: undefined, awayMoneyline: undefined },
      })
    );
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.predicted).toBe(true);
  });

  it("does not set predicted flag on post-game calculateNbaExcitement", () => {
    const game = makeNbaGame();
    const result = calculateNbaExcitement(game);
    expect(result.predicted).toBeUndefined();
  });

  it("clamps extreme scores", () => {
    const high = predictNbaExcitement(
      makePredictionInput({
        odds: makeOdds({ spread: 0, overUnder: 280, homeMoneyline: -105, awayMoneyline: -105 }),
        homeRank: 1,
        awayRank: 2,
      })
    );
    expect(high.score).toBeLessThanOrEqual(10);

    const low = predictNbaExcitement(
      makePredictionInput({
        odds: makeOdds({ spread: 20, overUnder: 180, homeMoneyline: -1000, awayMoneyline: +700 }),
      })
    );
    expect(low.score).toBeGreaterThanOrEqual(1);
  });
});
