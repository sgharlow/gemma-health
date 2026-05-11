import type { ToolDefinition } from "../ollama";
import { query } from "../db";

export const equityDetectorDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "equity_detector",
    description:
      "Compare outcomes between tribal CAHs and non-tribal CAHs on a given measure, surfacing the equity gap. Foundational to Indigenous Data Sovereignty conversations.",
    parameters: {
      type: "object",
      properties: {
        measure_id: {
          type: "string",
          description: "Quality measure ID, e.g. 'HCAHPS_OVERALL', 'MORT_30_HF', 'ED_THROUGHPUT'",
        },
      },
      required: ["measure_id"],
    },
  },
};

interface Args {
  measure_id: string;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export async function equityDetector(args: Args) {
  const rows = await query<{ score: number; tribal: boolean }>(
    `SELECT q.score, f.tribal
     FROM quality q JOIN facilities f ON f.facility_id = q.facility_id
     WHERE q.measure_id = ?`,
    [args.measure_id],
  );
  if (rows.length === 0) return { error: `no data for measure ${args.measure_id}` };

  const tribal = rows.filter((r) => r.tribal).map((r) => Number(r.score));
  const nonTribal = rows.filter((r) => !r.tribal).map((r) => Number(r.score));

  const tribalMean = mean(tribal);
  const nonTribalMean = mean(nonTribal);
  const gap = tribalMean - nonTribalMean;

  return {
    measure_id: args.measure_id,
    tribal: { n: tribal.length, mean: Number(tribalMean.toFixed(2)) },
    non_tribal: { n: nonTribal.length, mean: Number(nonTribalMean.toFixed(2)) },
    gap: Number(gap.toFixed(2)),
    interpretation:
      tribal.length === 0 || nonTribal.length === 0
        ? "Insufficient data in one of the cohorts."
        : Math.abs(gap) < 1
          ? "No meaningful equity gap detected on this measure."
          : `Tribal CAH cohort scores ${gap > 0 ? "higher" : "lower"} by ${Math.abs(gap).toFixed(1)} units. Direction of "better" depends on the measure: lower mortality is better; higher HCAHPS is better.`,
    data_source: "demo_seed",
  };
}
