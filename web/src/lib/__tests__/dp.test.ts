import { describe, expect, it } from "vitest";
import { addLaplaceNoise, dpCount, dpMean, dpSum, aggregateMeasure } from "../dp";

function fixedRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("addLaplaceNoise", () => {
  it("returns the value when the rng yields the median (u = 0.5 → 0 noise)", () => {
    const rng = fixedRng([0.5]);
    expect(addLaplaceNoise(10, 1, { epsilon: 1, rng })).toBeCloseTo(10);
  });

  it("rejects epsilon <= 0", () => {
    expect(() => addLaplaceNoise(10, 1, { epsilon: 0 })).toThrow();
    expect(() => addLaplaceNoise(10, 1, { epsilon: -1 })).toThrow();
  });

  it("noise variance scales as 2*(sensitivity/epsilon)^2 over many samples", () => {
    const samples = 5000;
    const epsilon = 1;
    const sensitivity = 1;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < samples; i++) {
      const n = addLaplaceNoise(0, sensitivity, { epsilon });
      sum += n;
      sumSq += n * n;
    }
    const variance = sumSq / samples - (sum / samples) ** 2;
    const expected = 2 * (sensitivity / epsilon) ** 2;
    expect(variance).toBeGreaterThan(expected * 0.7);
    expect(variance).toBeLessThan(expected * 1.3);
  });
});

describe("dpCount", () => {
  it("clamps at 0 (no negative counts leaked)", () => {
    const rng = fixedRng([0.001]);
    expect(dpCount(0, { epsilon: 0.1, rng })).toBe(0);
  });
  it("returns an integer near the raw value", () => {
    const v = dpCount(100, { epsilon: 1 });
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThan(80);
    expect(v).toBeLessThan(120);
  });
});

describe("dpSum + dpMean", () => {
  it("dpSum clamps inputs to the declared range", () => {
    const values = [-100, 0, 50, 100, 1000];
    const rng = fixedRng([0.5]);
    const result = dpSum(values, [0, 100], { epsilon: 1, rng });
    expect(result).toBeCloseTo(250);
  });
  it("dpMean returns mean for empty array", () => {
    expect(dpMean([], [0, 100], { epsilon: 1 })).toBe(0);
  });
  it("dpMean approximates the raw mean for many records", () => {
    const values = Array.from({ length: 1000 }, () => 50);
    const result = dpMean(values, [0, 100], { epsilon: 1 });
    expect(result).toBeGreaterThan(48);
    expect(result).toBeLessThan(52);
  });
});

describe("aggregateMeasure", () => {
  it("returns both raw and dp values + epsilon record", () => {
    const out = aggregateMeasure("HCAHPS_OVERALL", [70, 72, 75, 80, 85], [0, 100], { epsilon: 1 });
    expect(out.metric).toBe("HCAHPS_OVERALL");
    expect(out.raw_count).toBe(5);
    expect(out.epsilon).toBe(1);
    expect(out.dp_mean).toBeGreaterThan(0);
  });
});
