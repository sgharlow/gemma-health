import type { ToolDefinition } from "../ollama";

export const facilityBenchmarkDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "facility_benchmark",
    description:
      "Compare a single hospital's quality metric against peer Critical Access Hospitals in the same CMS region. Returns the facility's score, peer median, percentile rank, and the top contributing DRGs if applicable.",
    parameters: {
      type: "object",
      properties: {
        facility_id: { type: "string", description: "CMS Provider ID (e.g., '030063')" },
        region: { type: "string", description: "CMS region, e.g., 'Region 8'" },
        metric: {
          type: "string",
          description: "Quality metric to benchmark",
          enum: ["readmission_rate_30d", "ed_throughput_min", "hcahps_overall", "mortality_rate_30d"],
        },
      },
      required: ["facility_id", "metric"],
    },
  },
};

interface FacilityBenchmarkArgs {
  facility_id: string;
  region?: string;
  metric: "readmission_rate_30d" | "ed_throughput_min" | "hcahps_overall" | "mortality_rate_30d";
}

interface FacilityBenchmarkResult {
  facility_id: string;
  region: string;
  metric: string;
  facility_score: number;
  peer_median: number;
  peer_p25: number;
  peer_p75: number;
  percentile_rank: number;
  unit: string;
  top_contributing_drgs?: Array<{ drg: string; description: string; share: number }>;
  note: string;
}

export function facilityBenchmark(args: FacilityBenchmarkArgs): FacilityBenchmarkResult {
  const seed: Record<string, Omit<FacilityBenchmarkResult, "facility_id" | "region" | "metric">> = {
    readmission_rate_30d: {
      facility_score: 14.2,
      peer_median: 11.8,
      peer_p25: 10.4,
      peer_p75: 13.6,
      percentile_rank: 82,
      unit: "%",
      top_contributing_drgs: [
        { drg: "291", description: "Heart failure & shock w MCC", share: 0.28 },
        { drg: "190", description: "COPD w MCC", share: 0.17 },
        { drg: "871", description: "Septicemia w/o MV >96 hrs w MCC", share: 0.11 },
      ],
      note: "Day-1 stub data — replaces with real CMS data on Day 2.",
    },
    ed_throughput_min: {
      facility_score: 184,
      peer_median: 162,
      peer_p25: 138,
      peer_p75: 195,
      percentile_rank: 71,
      unit: "minutes",
      note: "Day-1 stub data.",
    },
    hcahps_overall: {
      facility_score: 78,
      peer_median: 81,
      peer_p25: 76,
      peer_p75: 86,
      percentile_rank: 33,
      unit: "% top-box",
      note: "Day-1 stub data.",
    },
    mortality_rate_30d: {
      facility_score: 13.1,
      peer_median: 12.4,
      peer_p25: 10.9,
      peer_p75: 14.0,
      percentile_rank: 58,
      unit: "%",
      note: "Day-1 stub data.",
    },
  };
  const s = seed[args.metric];
  return {
    facility_id: args.facility_id,
    region: args.region ?? "Region 8",
    metric: args.metric,
    ...s,
  };
}
