import type { ToolDefinition } from "../ollama";
import { query } from "../db";

export const crossCuttingAnalysisDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "cross_cutting_analysis",
    description:
      "Test whether two quality measures correlate across CAHs. Useful for hypothesis-checking, e.g. 'do hospitals with worse HCAHPS also have higher readmissions?'",
    parameters: {
      type: "object",
      properties: {
        measure_a: { type: "string", description: "First measure ID, e.g. 'HCAHPS_OVERALL'" },
        measure_b: { type: "string", description: "Second measure ID, e.g. 'MORT_30_HF'" },
      },
      required: ["measure_a", "measure_b"],
    },
  },
};

interface Args {
  measure_a: string;
  measure_b: string;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

export async function crossCuttingAnalysis(args: Args) {
  const rows = await query<{ facility_id: string; a: number | null; b: number | null }>(
    `SELECT f.facility_id,
            (SELECT score FROM quality WHERE facility_id = f.facility_id AND measure_id = ?) AS a,
            (SELECT score FROM quality WHERE facility_id = f.facility_id AND measure_id = ?) AS b
     FROM facilities f`,
    [args.measure_a, args.measure_b],
  );
  const paired = rows.filter((r) => r.a != null && r.b != null);
  if (paired.length < 3) {
    return { error: `not enough paired observations (${paired.length}) for ${args.measure_a} vs ${args.measure_b}` };
  }
  const xs = paired.map((r) => Number(r.a));
  const ys = paired.map((r) => Number(r.b));
  const r = pearson(xs, ys);
  return {
    measure_a: args.measure_a,
    measure_b: args.measure_b,
    n: paired.length,
    pearson_r: Number(r.toFixed(3)),
    interpretation:
      Math.abs(r) < 0.2
        ? "No meaningful correlation."
        : Math.abs(r) < 0.5
          ? `Weak ${r > 0 ? "positive" : "negative"} correlation.`
          : Math.abs(r) < 0.8
            ? `Moderate ${r > 0 ? "positive" : "negative"} correlation.`
            : `Strong ${r > 0 ? "positive" : "negative"} correlation.`,
    data_source: "demo_seed",
  };
}
