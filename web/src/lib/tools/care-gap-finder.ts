import type { ToolDefinition } from "../ollama";
import { query } from "../db";

export const careGapFinderDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "care_gap_finder",
    description:
      "Find the most actionable care gaps at a facility — measures where the score is worse than national, plus DRGs with excess readmission ratio > 1.0. Returns ranked, with a one-sentence intervention hint per gap.",
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

const HINTS: Record<string, string> = {
  HCAHPS_OVERALL: "Audit discharge communication scripts and run nurse-leader rounding cadence review.",
  MORT_30_HF: "Verify HF discharge bundle (med rec, follow-up scheduled within 7d, scale + diuretic adjust plan).",
  MORT_30_AMI: "Review door-to-balloon / door-to-needle times and confirm all eligible patients on dual antiplatelet at discharge.",
  ED_THROUGHPUT: "Review triage-to-bed handoff and consider provider-in-triage during peak hours.",
  SEP_1: "Refresh sepsis bundle education; audit 3-hr lactate/cultures/antibiotics compliance.",
  READM_30_HF: "Pilot transitional care visits within 7 days for HF discharges; verify diuretic titration plans.",
  READM_30_COPD: "Standardize COPD action plans + pulmonary follow-up scheduling at discharge.",
  READM_30_AMI: "Confirm cardiac rehab referrals and DAPT adherence at 30 days.",
  READM_30_PN: "Verify pneumococcal/influenza vax and 14-day primary care follow-up for all PN discharges.",
};

export async function careGapFinder(args: Args) {
  const qualityGaps = await query<{ measure_id: string; measure_name: string; score: number }>(
    `SELECT measure_id, measure_name, score FROM quality
     WHERE facility_id = ? AND compared_to_national = 'worse'
     ORDER BY score DESC`,
    [args.facility_id],
  );

  const readmGaps = await query<{ measure_id: string; drg_description: string; excess_readmission_ratio: number; number_of_readmissions: number }>(
    `SELECT measure_id, drg_description, excess_readmission_ratio, number_of_readmissions
     FROM readmissions WHERE facility_id = ? AND excess_readmission_ratio > 1.0
     ORDER BY excess_readmission_ratio DESC`,
    [args.facility_id],
  );

  const gaps = [
    ...qualityGaps.map((q) => ({
      kind: "quality_measure" as const,
      measure_id: q.measure_id,
      label: q.measure_name,
      score: Number(q.score),
      hint: HINTS[q.measure_id] ?? "Investigate workflow and documentation for this measure.",
    })),
    ...readmGaps.map((r) => ({
      kind: "readmission_drg" as const,
      measure_id: r.measure_id,
      label: `${r.drg_description} (${r.number_of_readmissions} readmissions)`,
      excess_ratio: Number(r.excess_readmission_ratio),
      hint: HINTS[r.measure_id] ?? "Investigate transitions of care for this DRG.",
    })),
  ];

  return {
    facility_id: args.facility_id,
    gap_count: gaps.length,
    gaps: gaps.slice(0, 10),
    data_source: "demo_seed",
  };
}
