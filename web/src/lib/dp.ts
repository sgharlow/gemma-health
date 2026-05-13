/**
 * Differential privacy via the Laplace mechanism.
 *
 * Neighboring-datasets definition: ADD-OR-REMOVE-ONE record (the standard
 * unbounded DP convention). Sensitivities under this definition:
 *
 *   - count: Δ = 1  (one record changes the count by exactly 1)
 *   - sum over values clamped to [a,b]: Δ = (b - a)
 *     (one record can contribute at most (b - a) to the clamped sum)
 *   - mean: NOT released directly. Instead we release the clamped sum
 *     (sensitivity b - a) and treat `n` as public, then divide. This avoids
 *     the (b - a)/n sensitivity that depends on the record count, which
 *     leaks information about n under add-or-remove neighboring datasets.
 *
 * Budget: each scalar release spends ε. Composition is the operator's
 * responsibility — `egress.ts` records the per-envelope budget; the ledger
 * sums lifetime ε via the `dp_epsilon` field on every entry.
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

/**
 * DP mean = (DP-sum) / public-n. Sensitivity of the sum is (hi - lo); we
 * treat n as public (it is reported as raw_count in the envelope). For
 * empty input we return 0 with no noise spend.
 */
export function dpMean(values: number[], range: [number, number], opts: DpOptions): number {
  if (values.length === 0) return 0;
  const noisedSum = dpSum(values, range, opts);
  return noisedSum / values.length;
}

export interface DpAggregate {
  metric: string;
  raw_count?: number;
  dp_count?: number;
  raw_mean?: number;
  dp_mean?: number;
  epsilon: number;
  /**
   * Sensitivity of the noised query in operator-visible units. For a mean
   * computed as DP-sum/n with public n, this is (hi - lo) / n — the
   * effective per-record impact on the released value.
   */
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
