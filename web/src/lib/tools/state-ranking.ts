import type { ToolDefinition } from "../ollama";
import { query } from "../db";

export const stateRankingDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "state_ranking",
    description:
      "Rank states by mean CAH performance on a given measure. Useful for understanding regional patterns.",
    parameters: {
      type: "object",
      properties: {
        measure_id: { type: "string", description: "Quality measure ID" },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort direction. For mortality use 'asc' (low is better), for HCAHPS use 'desc'.",
        },
      },
      required: ["measure_id"],
    },
  },
};

interface Args {
  measure_id: string;
  order?: "asc" | "desc";
}

export async function stateRanking(args: Args) {
  const order = args.order === "desc" ? "DESC" : "ASC";
  const rows = await query<{ state: string; n: number; mean: number }>(
    `SELECT f.state, COUNT(*) AS n, AVG(q.score) AS mean
     FROM quality q JOIN facilities f ON f.facility_id = q.facility_id
     WHERE q.measure_id = ?
     GROUP BY f.state
     ORDER BY mean ${order}`,
    [args.measure_id],
  );
  if (rows.length === 0) return { error: `no data for measure ${args.measure_id}` };
  return {
    measure_id: args.measure_id,
    order: args.order ?? "asc",
    rankings: rows.map((r, i) => ({
      rank: i + 1,
      state: r.state,
      facility_count: Number(r.n),
      mean_score: Number(Number(r.mean).toFixed(2)),
    })),
    data_source: "demo_seed",
  };
}
