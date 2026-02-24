import { describe, it, expect } from "vitest";
import { getLabel, clampScore } from "../types";

describe("getLabel", () => {
  it("returns 'Must Watch' for scores >= 8", () => {
    expect(getLabel(8)).toBe("Must Watch");
    expect(getLabel(9.5)).toBe("Must Watch");
    expect(getLabel(10)).toBe("Must Watch");
  });

  it("returns 'Good Watch' for scores 6-7.9", () => {
    expect(getLabel(6)).toBe("Good Watch");
    expect(getLabel(7)).toBe("Good Watch");
    expect(getLabel(7.9)).toBe("Good Watch");
  });

  it("returns 'Fair Game' for scores 4-5.9", () => {
    expect(getLabel(4)).toBe("Fair Game");
    expect(getLabel(5)).toBe("Fair Game");
    expect(getLabel(5.9)).toBe("Fair Game");
  });

  it("returns 'Skip It' for scores < 4", () => {
    expect(getLabel(1)).toBe("Skip It");
    expect(getLabel(3)).toBe("Skip It");
    expect(getLabel(3.9)).toBe("Skip It");
  });
});

describe("clampScore", () => {
  it("clamps below 1 to 1", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-5)).toBe(1);
  });

  it("clamps above 10 to 10", () => {
    expect(clampScore(15)).toBe(10);
    expect(clampScore(10.5)).toBe(10);
  });

  it("rounds to 1 decimal place", () => {
    expect(clampScore(5.55)).toBe(5.6);
    expect(clampScore(7.123)).toBe(7.1);
    expect(clampScore(3.99)).toBe(4);
  });

  it("keeps values within range as-is (with rounding)", () => {
    expect(clampScore(1)).toBe(1);
    expect(clampScore(5)).toBe(5);
    expect(clampScore(10)).toBe(10);
  });
});
