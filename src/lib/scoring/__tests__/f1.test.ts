import { describe, it, expect } from "vitest";
import {
  calculateF1Excitement,
  detectF1EasterEggs,
  predictF1Excitement,
} from "../f1";
import type { F1EventData, F1Driver } from "../../api/f1";

function makeDriver(
  name: string,
  team?: string,
  overrides: Partial<F1Driver> = {}
): F1Driver {
  return {
    id: name.toLowerCase().replace(/\s/g, "-"),
    name,
    team,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<F1EventData> = {}): F1EventData {
  return {
    id: "1",
    name: "Test Grand Prix",
    circuit: "Test Circuit",
    date: "2025-03-14T01:30Z",
    endDate: "2025-03-16T04:00Z",
    status: "STATUS_FINAL",
    qualifyingResults: [
      makeDriver("Driver A", "McLaren"),
      makeDriver("Driver B", "Red Bull"),
      makeDriver("Driver C", "Ferrari"),
      makeDriver("Driver D", "Mercedes"),
      makeDriver("Driver E", "Aston Martin"),
    ],
    raceResults: [
      makeDriver("Driver A", "McLaren"),
      makeDriver("Driver B", "Red Bull"),
      makeDriver("Driver C", "Ferrari"),
      makeDriver("Driver D", "Mercedes"),
      makeDriver("Driver E", "Aston Martin"),
    ],
    ...overrides,
  };
}

describe("calculateF1Excitement", () => {
  it("gives a low score for a processional race (no position changes)", () => {
    const event = makeEvent();
    const result = calculateF1Excitement(event);
    expect(result.score).toBeLessThan(5);
  });

  it("gives a higher score when positions change significantly", () => {
    const qual = [
      makeDriver("A", "McLaren"),
      makeDriver("B", "Red Bull"),
      makeDriver("C", "Ferrari"),
      makeDriver("D", "Mercedes"),
      makeDriver("E", "Aston Martin"),
      makeDriver("F", "Williams"),
      makeDriver("G", "Alpine"),
      makeDriver("H", "Haas"),
      makeDriver("I", "Kick Sauber"),
      makeDriver("J", "RB"),
    ];
    // Completely reversed order
    const race = [...qual].reverse();

    const event = makeEvent({
      qualifyingResults: qual,
      raceResults: race,
    });
    const result = calculateF1Excitement(event);
    expect(result.score).toBeGreaterThan(6);
  });

  it("gives a bonus when the winner didn't start on pole", () => {
    const event = makeEvent({
      qualifyingResults: [
        makeDriver("Driver A", "McLaren"),
        makeDriver("Driver B", "Red Bull"),
        makeDriver("Driver C", "Ferrari"),
      ],
      raceResults: [
        makeDriver("Driver C", "Ferrari"),
        makeDriver("Driver A", "McLaren"),
        makeDriver("Driver B", "Red Bull"),
      ],
    });
    const result = calculateF1Excitement(event);

    // Compare with pole sitter winning
    const processional = makeEvent();
    const processionalResult = calculateF1Excitement(processional);

    expect(result.score).toBeGreaterThan(processionalResult.score);
  });

  it("gives a bonus for underdog team winning", () => {
    const event = makeEvent({
      raceResults: [
        makeDriver("Driver E", "Williams"),
        makeDriver("Driver A", "McLaren"),
        makeDriver("Driver B", "Red Bull"),
        makeDriver("Driver C", "Ferrari"),
        makeDriver("Driver D", "Mercedes"),
      ],
      qualifyingResults: [
        makeDriver("Driver A", "McLaren"),
        makeDriver("Driver B", "Red Bull"),
        makeDriver("Driver C", "Ferrari"),
        makeDriver("Driver D", "Mercedes"),
        makeDriver("Driver E", "Williams"),
      ],
    });
    const result = calculateF1Excitement(event);
    expect(result.score).toBeGreaterThan(6);
  });

  it("gives standings bonus when championship contenders finish 1-2", () => {
    const standings = new Map([
      ["Driver A", 1],
      ["Driver B", 2],
      ["Driver C", 5],
    ]);
    const event = makeEvent();
    const withStandings = calculateF1Excitement(event, standings);
    const withoutStandings = calculateF1Excitement(event);
    expect(withStandings.score).toBeGreaterThanOrEqual(withoutStandings.score);
  });

  it("clamps score between 1 and 10", () => {
    const event = makeEvent();
    const result = calculateF1Excitement(event);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it("returns a valid label", () => {
    const event = makeEvent();
    const result = calculateF1Excitement(event);
    expect(["Must Watch", "Good Watch", "Fair Game", "Skip It"]).toContain(
      result.label
    );
  });
});

describe("detectF1EasterEggs", () => {
  it("returns only expected eggs for a normal processional race", () => {
    const event = makeEvent();
    const eggs = detectF1EasterEggs(event);
    const ids = eggs.map((e) => e.id);
    // No position changes + 5 different teams = procession + mixed-podium
    expect(ids).toContain("procession");
    expect(ids).not.toContain("giant-killer");
    expect(ids).not.toContain("comeback-king");
    expect(ids).not.toContain("grid-scramble");
  });

  it("detects procession when very few position changes", () => {
    const event = makeEvent();
    const eggs = detectF1EasterEggs(event);
    expect(eggs.some((e) => e.id === "procession")).toBe(true);
  });

  it("detects giant killer when non-top team wins", () => {
    const event = makeEvent({
      raceResults: [
        makeDriver("Driver E", "Williams"),
        makeDriver("Driver A", "McLaren"),
        makeDriver("Driver B", "Red Bull"),
      ],
    });
    const eggs = detectF1EasterEggs(event);
    expect(eggs.some((e) => e.id === "giant-killer")).toBe(true);
  });

  it("detects comeback king when winner started P5+", () => {
    const event = makeEvent({
      qualifyingResults: [
        makeDriver("A", "McLaren"),
        makeDriver("B", "Red Bull"),
        makeDriver("C", "Ferrari"),
        makeDriver("D", "Mercedes"),
        makeDriver("E", "Aston Martin"),
        makeDriver("F", "Williams"),
      ],
      raceResults: [
        makeDriver("F", "Williams"),
        makeDriver("A", "McLaren"),
        makeDriver("B", "Red Bull"),
      ],
    });
    const eggs = detectF1EasterEggs(event);
    expect(eggs.some((e) => e.id === "comeback-king")).toBe(true);
  });

  it("detects mixed podium when 5 teams in top 5", () => {
    const event = makeEvent({
      raceResults: [
        makeDriver("A", "McLaren"),
        makeDriver("B", "Red Bull"),
        makeDriver("C", "Ferrari"),
        makeDriver("D", "Mercedes"),
        makeDriver("E", "Williams"),
      ],
    });
    const eggs = detectF1EasterEggs(event);
    expect(eggs.some((e) => e.id === "mixed-podium")).toBe(true);
  });
});

describe("predictF1Excitement", () => {
  it("returns a predicted result", () => {
    const result = predictF1Excitement({});
    expect(result.predicted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it("scores higher with tight championship standings", () => {
    const standings = new Map([
      ["Driver A", 1],
      ["Driver B", 2],
    ]);
    const withStandings = predictF1Excitement({ standings });
    const withoutStandings = predictF1Excitement({});
    expect(withStandings.score).toBeGreaterThanOrEqual(
      withoutStandings.score
    );
  });
});
