import { describe, it, expect } from "vitest";
import {
  calculateQualifyingExcitement,
  detectQualifyingEasterEggs,
  calculateRaceExcitement,
  detectRaceEasterEggs,
  predictRaceExcitement,
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
  const drivers = [
    makeDriver("Driver A", "McLaren"),
    makeDriver("Driver B", "Red Bull"),
    makeDriver("Driver C", "Ferrari"),
    makeDriver("Driver D", "Mercedes"),
    makeDriver("Driver E", "Aston Martin"),
  ];
  return {
    id: "1",
    name: "Test Grand Prix",
    circuit: "Test Circuit",
    qualifying: {
      type: "qualifying",
      status: "STATUS_FINAL",
      finished: true,
      date: "2025-03-15T05:00Z",
      results: [...drivers],
    },
    race: {
      type: "race",
      status: "STATUS_FINAL",
      finished: true,
      date: "2025-03-16T04:00Z",
      results: [...drivers],
    },
    ...overrides,
  };
}

// ── Qualifying ──

describe("calculateQualifyingExcitement", () => {
  it("returns a score for qualifying results", () => {
    const results = [
      makeDriver("A", "McLaren"),
      makeDriver("B", "Red Bull"),
      makeDriver("C", "Ferrari"),
    ];
    const result = calculateQualifyingExcitement(results);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it("scores higher with underdog on pole", () => {
    const normalQual = [
      makeDriver("A", "McLaren"),
      makeDriver("B", "Red Bull"),
    ];
    const underdogQual = [
      makeDriver("A", "Williams"),
      makeDriver("B", "Red Bull"),
    ];
    const normal = calculateQualifyingExcitement(normalQual);
    const underdog = calculateQualifyingExcitement(underdogQual);
    expect(underdog.score).toBeGreaterThan(normal.score);
  });

  it("scores higher with diverse teams in top 5", () => {
    const sameteam = [
      makeDriver("A", "McLaren"),
      makeDriver("B", "McLaren"),
      makeDriver("C", "McLaren"),
      makeDriver("D", "McLaren"),
      makeDriver("E", "McLaren"),
    ];
    const diverse = [
      makeDriver("A", "McLaren"),
      makeDriver("B", "Red Bull"),
      makeDriver("C", "Ferrari"),
      makeDriver("D", "Mercedes"),
      makeDriver("E", "Williams"),
    ];
    const sameResult = calculateQualifyingExcitement(sameteam);
    const diverseResult = calculateQualifyingExcitement(diverse);
    expect(diverseResult.score).toBeGreaterThan(sameResult.score);
  });

  it("returns base score for empty results", () => {
    const result = calculateQualifyingExcitement([]);
    expect(result.score).toBe(4.5);
  });
});

describe("detectQualifyingEasterEggs", () => {
  it("detects shock pole for non-top team", () => {
    const results = [
      makeDriver("A", "Williams"),
      makeDriver("B", "McLaren"),
    ];
    const eggs = detectQualifyingEasterEggs(results);
    expect(eggs.some((e) => e.id === "shock-pole")).toBe(true);
  });

  it("detects mixed grid", () => {
    const results = [
      makeDriver("A", "McLaren"),
      makeDriver("B", "Red Bull"),
      makeDriver("C", "Ferrari"),
      makeDriver("D", "Mercedes"),
      makeDriver("E", "Williams"),
    ];
    const eggs = detectQualifyingEasterEggs(results);
    expect(eggs.some((e) => e.id === "mixed-grid")).toBe(true);
  });

  it("returns empty for normal qualifying", () => {
    const results = [
      makeDriver("A", "McLaren"),
      makeDriver("B", "McLaren"),
    ];
    const eggs = detectQualifyingEasterEggs(results);
    expect(eggs).toEqual([]);
  });
});

// ── Race ──

describe("calculateRaceExcitement", () => {
  it("gives a low score for a processional race", () => {
    const event = makeEvent();
    const result = calculateRaceExcitement(event);
    expect(result.score).toBeLessThan(5);
  });

  it("gives a higher score when positions change significantly", () => {
    const qual = Array.from({ length: 10 }, (_, i) =>
      makeDriver(`D${i}`, ["McLaren", "Red Bull", "Ferrari", "Mercedes", "Williams"][i % 5])
    );
    const race = [...qual].reverse();

    const event = makeEvent({
      qualifying: { type: "qualifying", status: "STATUS_FINAL", finished: true, date: "2025-03-15T05:00Z", results: qual },
      race: { type: "race", status: "STATUS_FINAL", finished: true, date: "2025-03-16T04:00Z", results: race },
    });
    const result = calculateRaceExcitement(event);
    expect(result.score).toBeGreaterThan(6);
  });

  it("gives a bonus for underdog team winning", () => {
    const event = makeEvent({
      race: {
        type: "race", status: "STATUS_FINAL", finished: true, date: "2025-03-16T04:00Z",
        results: [
          makeDriver("E", "Williams"),
          makeDriver("A", "McLaren"),
          makeDriver("B", "Red Bull"),
          makeDriver("C", "Ferrari"),
          makeDriver("D", "Mercedes"),
        ],
      },
    });
    const result = calculateRaceExcitement(event);
    expect(result.score).toBeGreaterThan(6);
  });

  it("clamps score between 1 and 10", () => {
    const event = makeEvent();
    const result = calculateRaceExcitement(event);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
  });
});

describe("detectRaceEasterEggs", () => {
  it("detects procession when very few position changes", () => {
    const event = makeEvent();
    const eggs = detectRaceEasterEggs(event);
    expect(eggs.some((e) => e.id === "procession")).toBe(true);
  });

  it("detects giant killer when non-top team wins", () => {
    const event = makeEvent({
      race: {
        type: "race", status: "STATUS_FINAL", finished: true, date: "2025-03-16T04:00Z",
        results: [makeDriver("E", "Williams"), makeDriver("A", "McLaren")],
      },
    });
    const eggs = detectRaceEasterEggs(event);
    expect(eggs.some((e) => e.id === "giant-killer")).toBe(true);
  });

  it("detects comeback king when winner started P5+", () => {
    const event = makeEvent({
      qualifying: {
        type: "qualifying", status: "STATUS_FINAL", finished: true, date: "2025-03-15T05:00Z",
        results: [
          makeDriver("A"), makeDriver("B"), makeDriver("C"),
          makeDriver("D"), makeDriver("E"), makeDriver("F"),
        ],
      },
      race: {
        type: "race", status: "STATUS_FINAL", finished: true, date: "2025-03-16T04:00Z",
        results: [makeDriver("F"), makeDriver("A"), makeDriver("B")],
      },
    });
    const eggs = detectRaceEasterEggs(event);
    expect(eggs.some((e) => e.id === "comeback-king")).toBe(true);
  });
});

// ── Prediction ──

describe("predictRaceExcitement", () => {
  it("returns a predicted result", () => {
    const result = predictRaceExcitement({});
    expect(result.predicted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it("scores higher with tight championship standings", () => {
    const standings = new Map([["Driver A", 1], ["Driver B", 2]]);
    const withStandings = predictRaceExcitement({ standings });
    const withoutStandings = predictRaceExcitement({});
    expect(withStandings.score).toBeGreaterThanOrEqual(withoutStandings.score);
  });

  it("scores higher with diverse qualifying grid", () => {
    const diverseQual = [
      makeDriver("A", "McLaren"),
      makeDriver("B", "Red Bull"),
      makeDriver("C", "Ferrari"),
      makeDriver("D", "Mercedes"),
      makeDriver("E", "Williams"),
    ];
    const withQual = predictRaceExcitement({ qualifyingResults: diverseQual });
    const withoutQual = predictRaceExcitement({});
    expect(withQual.score).toBeGreaterThan(withoutQual.score);
  });
});
