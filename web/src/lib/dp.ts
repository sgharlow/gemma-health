/**
 * Differential privacy via the Laplace mechanism.
 *
 * For a numeric query f with sensitivity Δ, releasing f(x) + Lap(Δ/ε)
 * is ε-differentially private. Sensitivity is the maximum change in f
 * caused by adding/removing one record:
 *   - count: Δ = 1
 *   - sum over a clamped range [a,b]: Δ = b - a
 *   - mean over n records in [a,b]: Δ = (b - a) / n
 */

function laplaceSample(scale: number, rng: () => number = Math.random): number {
  // Inverse CDF: -scale * sign(u) * ln(1 - 2|u|) for u ∈ (-0.5, 0.5)
  const u = rng() - 0.5;
  const sign = u < 0 ? -1 : 1;
  return -scale * sign * Math.log(1 - 2 * Math.abs(u));
}

export interface DpOptions {
  epsilon: number;
  rng?: () => number;
}

export function addLaplaceNoise(value: number, sensitivity: number, opts: DpOptions): number {
  if (opts.epsilon <= 0) throw new Error("epsilon must be > 0");
  if (sensitivity < 0) throw new Error("sensitivity must be >= 0");
  return value + laplaceSample(sensitivity / opts.epsilon, opts.rng);
}

export function dpCount(rawCount: number, opts: DpOptions): number {
  return Math.max(0, Math.round(addLaplaceNoise(rawCount, 1, opts)));
}

export function dpSum(values: number[], range: [number, number], opts: DpOptions): number {
  const [lo, hi] = range;
  if (hi < lo) throw new Error("range must be [lo, hi] with lo <= hi");
  const clamped = values.map((v) => Math.min(hi, Math.max(lo, v)));
  const sum = clamped.reduce((a, b) => a + b, 0);
  return addLaplaceNoise(sum, hi - lo, opts);
}

export function dpMean(values: number[], range: [number, number], opts: DpOptions): number {
  if (values.length === 0) return 0;
  const [lo, hi] = range;
  const clamped = values.map((v) => Math.min(hi, Math.max(lo, v)));
  const mean = clamped.reduce((a, b) => a + b, 0) / clamped.length;
  return addLaplaceNoise(mean, (hi - lo) / clamped.length, opts);
}

export interface DpAggregate {
  metric: string;
  raw_count?: number;
  dp_count?: number;
  raw_mean?: number;
  dp_mean?: number;
  epsilon: number;
  sensitivity: number;
}

export function aggregateMeasure(
  measureId: string,
  values: number[],
  range: [number, number],
  opts: DpOptions,
): DpAggregate {
  return {
    metric: measureId,
    raw_count: values.length,
    dp_count: dpCount(values.length, opts),
    raw_mean: values.length === 0 ? 0 : Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
    dp_mean: values.length === 0 ? 0 : Number(dpMean(values, range, opts).toFixed(2)),
    epsilon: opts.epsilon,
    sensitivity: (range[1] - range[0]) / Math.max(values.length, 1),
  };
}
