import type { ToolDefinition } from "../ollama";
import { query } from "../db";

export const qualityMonitorDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "quality_monitor",
    description:
      "List all quality measures and scores for a facility, sorted by deviation from national. Use to scan a hospital's overall posture.",
    parameters: {
      type: "object",
      properties: {
        facility_id: { type: "string", description: "Facility ID" },
      },
      required: ["facility_id"],
    },
  },
};

interface Args {
  facility_id: string;
}

export async function qualityMonitor(args: Args) {
  const measures = await query<{
    measure_id: string;
    measure_name: string;
    score: number;
    compared_to_national: string;
  }>(
    `SELECT measure_id, measure_name, score, compared_to_national
     FROM quality WHERE facility_id = ?
     ORDER BY CASE compared_to_national
       WHEN 'worse' THEN 0 WHEN 'no different' THEN 1 WHEN 'better' THEN 2 ELSE 3 END`,
    [args.facility_id],
  );
  if (measures.length === 0) return { error: `no quality measures found for ${args.facility_id}` };
  return {
    facility_id: args.facility_id,
    measure_count: measures.length,
    measures: measures.map((m) => ({
      measure_id: m.measure_id,
      measure_name: m.measure_name,
      score: Number(m.score),
      compared_to_national: m.compared_to_national,
    })),
    data_source: "demo_seed",
  };
}
