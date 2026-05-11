import type { ToolDefinition } from "../ollama";
import { query } from "../db";

export const facilityBenchmarkDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "facility_benchmark",
    description:
      "Compare a Critical Access Hospital's performance on a quality metric against peer CAHs in the same CMS region. Returns the facility's score, peer percentiles, and (for readmission metrics) the contributing DRGs.",
    parameters: {
      type: "object",
      properties: {
        facility_id: { type: "string", description: "Facility ID, e.g. 'DEMO-CAH-001'" },
        metric: {
          type: "string",
          description: "Quality metric to benchmark",
          enum: ["readmission_rate_30d_hf", "ed_throughput", "hcahps_overall", "mortality_30d_hf"],
        },
      },
      required: ["facility_id", "metric"],
    },
  },
};

const METRIC_MAP: Record<string, { source: "quality" | "readmissions"; measure_id: string; unit: string }> = {
  readmission_rate_30d_hf: { source: "readmissions", measure_id: "READM_30_HF", unit: "%" },
  ed_throughput: { source: "quality", measure_id: "ED_THROUGHPUT", unit: "minutes" },
  hcahps_overall: { source: "quality", measure_id: "HCAHPS_OVERALL", unit: "% top-box" },
  mortality_30d_hf: { source: "quality", measure_id: "MORT_30_HF", unit: "%" },
};

interface FacilityBenchmarkArgs {
  facility_id: string;
  metric: keyof typeof METRIC_MAP;
}

function percentile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  let count = 0;
  for (const v of sorted) if (v <= value) count++;
  return Math.round((count / sorted.length) * 100);
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] !== undefined ? (sorted[base + 1] - sorted[base]) * rest : 0);
}

export async function facilityBenchmark(args: FacilityBenchmarkArgs) {
  const cfg = METRIC_MAP[args.metric];
  if (!cfg) return { error: `unknown metric: ${args.metric}` };

  const fac = await query<{ facility_id: string; facility_name: string; state: string; cms_region: number; tribal: boolean }>(
    "SELECT facility_id, facility_name, state, cms_region, tribal FROM facilities WHERE facility_id = ?",
    [args.facility_id],
  );
  if (fac.length === 0) return { error: `facility not found: ${args.facility_id}` };
  const f = fac[0];

  let facilityScore: number | null = null;
  let peerScores: number[] = [];
  let contributingDrgs: Array<{ drg: string; description: string; excess_ratio: number; n: number }> = [];

  if (cfg.source === "readmissions") {
    const fRows = await query<{ predicted_readmission_rate: number }>(
      "SELECT predicted_readmission_rate FROM readmissions WHERE facility_id = ? AND measure_id = ?",
      [args.facility_id, cfg.measure_id],
    );
    facilityScore = fRows.length > 0 ? Number(fRows[0].predicted_readmission_rate) : null;

    const peers = await query<{ predicted_readmission_rate: number }>(
      `SELECT r.predicted_readmission_rate
       FROM readmissions r
       JOIN facilities fp ON fp.facility_id = r.facility_id
       WHERE r.measure_id = ? AND fp.cms_region = ? AND r.facility_id <> ?`,
      [cfg.measure_id, f.cms_region, args.facility_id],
    );
    peerScores = peers.map((p) => Number(p.predicted_readmission_rate));

    const drgs = await query<{ drg: string; drg_description: string; excess_readmission_ratio: number; number_of_readmissions: number }>(
      `SELECT drg, drg_description, excess_readmission_ratio, number_of_readmissions
       FROM readmissions
       WHERE facility_id = ?
       ORDER BY excess_readmission_ratio DESC`,
      [args.facility_id],
    );
    contributingDrgs = drgs.map((d) => ({
      drg: d.drg,
      description: d.drg_description,
      excess_ratio: Number(d.excess_readmission_ratio),
      n: Number(d.number_of_readmissions),
    }));
  } else {
    const fRows = await query<{ score: number }>(
      "SELECT score FROM quality WHERE facility_id = ? AND measure_id = ?",
      [args.facility_id, cfg.measure_id],
    );
    facilityScore = fRows.length > 0 ? Number(fRows[0].score) : null;

    const peers = await query<{ score: number }>(
      `SELECT q.score
       FROM quality q
       JOIN facilities fp ON fp.facility_id = q.facility_id
       WHERE q.measure_id = ? AND fp.cms_region = ? AND q.facility_id <> ?`,
      [cfg.measure_id, f.cms_region, args.facility_id],
    );
    peerScores = peers.map((p) => Number(p.score));
  }

  const sorted = [...peerScores].sort((a, b) => a - b);
  return {
    facility_id: f.facility_id,
    facility_name: f.facility_name,
    state: f.state,
    cms_region: Number(f.cms_region),
    tribal: !!f.tribal,
    metric: args.metric,
    unit: cfg.unit,
    facility_score: facilityScore,
    peer_count: sorted.length,
    peer_median: sorted.length > 0 ? quantile(sorted, 0.5) : null,
    peer_p25: sorted.length > 0 ? quantile(sorted, 0.25) : null,
    peer_p75: sorted.length > 0 ? quantile(sorted, 0.75) : null,
    percentile_rank: facilityScore != null && sorted.length > 0 ? percentile(sorted, facilityScore) : null,
    top_contributing_drgs: contributingDrgs.length > 0 ? contributingDrgs.slice(0, 3) : undefined,
    data_source: "demo_seed",
  };
}
