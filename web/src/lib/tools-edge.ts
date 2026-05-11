/**
 * Browser-side tool implementations — same definitions as server tools,
 * different handlers (read static JSON, no DuckDB).
 */

// NB: tool *definitions* are inlined here (not imported from lib/tools/*) so
// this module does not transitively pull in the DuckDB-backed handlers and
// remain bundleable for the browser. Definition contracts are duplicated
// verbatim with the server side; if a contract changes, change both.

import type { ToolDefinition } from "./ollama";
import { getFacilities, getQuality, getReadmissions } from "./edge-data";

const facilityBenchmarkDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "facility_benchmark",
    description:
      "Compare a Critical Access Hospital's performance on a quality metric against peer CAHs in the same CMS region.",
    parameters: {
      type: "object",
      properties: {
        facility_id: { type: "string" },
        metric: {
          type: "string",
          enum: ["readmission_rate_30d_hf", "ed_throughput", "hcahps_overall", "mortality_30d_hf"],
        },
      },
      required: ["facility_id", "metric"],
    },
  },
};

const qualityMonitorDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "quality_monitor",
    description:
      "List all quality measures and scores for a facility, sorted by deviation from national.",
    parameters: {
      type: "object",
      properties: { facility_id: { type: "string" } },
      required: ["facility_id"],
    },
  },
};

const careGapFinderDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "care_gap_finder",
    description:
      "Find the most actionable care gaps at a facility — measures worse than national + DRGs with excess readmission ratio > 1.0.",
    parameters: {
      type: "object",
      properties: { facility_id: { type: "string" } },
      required: ["facility_id"],
    },
  },
};

const equityDetectorDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "equity_detector",
    description:
      "Compare outcomes between tribal CAHs and non-tribal CAHs on a given measure, surfacing the equity gap.",
    parameters: {
      type: "object",
      properties: { measure_id: { type: "string" } },
      required: ["measure_id"],
    },
  },
};

const stateRankingDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "state_ranking",
    description: "Rank states by mean CAH performance on a given measure.",
    parameters: {
      type: "object",
      properties: {
        measure_id: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] },
      },
      required: ["measure_id"],
    },
  },
};

const crossCuttingAnalysisDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "cross_cutting_analysis",
    description: "Test whether two quality measures correlate across CAHs (Pearson r).",
    parameters: {
      type: "object",
      properties: {
        measure_a: { type: "string" },
        measure_b: { type: "string" },
      },
      required: ["measure_a", "measure_b"],
    },
  },
};

const METRIC_MAP: Record<string, { source: "quality" | "readmissions"; measure_id: string; unit: string }> = {
  readmission_rate_30d_hf: { source: "readmissions", measure_id: "READM_30_HF", unit: "%" },
  ed_throughput: { source: "quality", measure_id: "ED_THROUGHPUT", unit: "minutes" },
  hcahps_overall: { source: "quality", measure_id: "HCAHPS_OVERALL", unit: "% top-box" },
  mortality_30d_hf: { source: "quality", measure_id: "MORT_30_HF", unit: "%" },
};

const HINTS: Record<string, string> = {
  HCAHPS_OVERALL: "Audit discharge communication scripts and run nurse-leader rounding cadence review.",
  MORT_30_HF: "Verify HF discharge bundle.",
  MORT_30_AMI: "Review door-to-balloon times.",
  ED_THROUGHPUT: "Review triage-to-bed handoff.",
  SEP_1: "Refresh sepsis bundle education.",
  READM_30_HF: "Pilot transitional care visits within 7 days for HF discharges.",
  READM_30_COPD: "Standardize COPD action plans + pulmonary follow-up.",
  READM_30_AMI: "Confirm cardiac rehab referrals.",
  READM_30_PN: "Verify pneumococcal/influenza vax + 14-day follow-up.",
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] !== undefined ? (sorted[base + 1] - sorted[base]) * rest : 0);
}

function percentile(sorted: number[], v: number): number {
  if (sorted.length === 0) return 0;
  let count = 0;
  for (const x of sorted) if (x <= v) count++;
  return Math.round((count / sorted.length) * 100);
}

async function facilityBenchmarkEdge(args: { facility_id: string; metric: keyof typeof METRIC_MAP }) {
  const cfg = METRIC_MAP[args.metric];
  if (!cfg) return { error: `unknown metric: ${args.metric}` };
  const facilities = await getFacilities();
  const f = facilities.find((x) => x.facility_id === args.facility_id);
  if (!f) return { error: `facility not found: ${args.facility_id}` };

  let facilityScore: number | null = null;
  let peerScores: number[] = [];
  let drgs: Array<{ drg: string; description: string; excess_ratio: number; n: number }> = [];

  if (cfg.source === "readmissions") {
    const readmissions = await getReadmissions();
    const fr = readmissions.find((r) => r.facility_id === args.facility_id && r.measure_id === cfg.measure_id);
    facilityScore = fr ? fr.predicted_readmission_rate : null;
    const peerFacIds = new Set(facilities.filter((x) => x.cms_region === f.cms_region && x.facility_id !== f.facility_id).map((x) => x.facility_id));
    peerScores = readmissions.filter((r) => r.measure_id === cfg.measure_id && peerFacIds.has(r.facility_id)).map((r) => r.predicted_readmission_rate);
    drgs = readmissions
      .filter((r) => r.facility_id === args.facility_id)
      .sort((a, b) => b.excess_readmission_ratio - a.excess_readmission_ratio)
      .slice(0, 3)
      .map((r) => ({ drg: r.drg, description: r.drg_description, excess_ratio: r.excess_readmission_ratio, n: r.number_of_readmissions }));
  } else {
    const quality = await getQuality();
    const fq = quality.find((q) => q.facility_id === args.facility_id && q.measure_id === cfg.measure_id);
    facilityScore = fq ? fq.score : null;
    const peerFacIds = new Set(facilities.filter((x) => x.cms_region === f.cms_region && x.facility_id !== f.facility_id).map((x) => x.facility_id));
    peerScores = quality.filter((q) => q.measure_id === cfg.measure_id && peerFacIds.has(q.facility_id)).map((q) => q.score);
  }

  const sorted = [...peerScores].sort((a, b) => a - b);
  return {
    facility_id: f.facility_id,
    facility_name: f.facility_name,
    state: f.state,
    cms_region: f.cms_region,
    tribal: f.tribal,
    metric: args.metric,
    unit: cfg.unit,
    facility_score: facilityScore,
    peer_count: sorted.length,
    peer_median: sorted.length ? quantile(sorted, 0.5) : null,
    peer_p25: sorted.length ? quantile(sorted, 0.25) : null,
    peer_p75: sorted.length ? quantile(sorted, 0.75) : null,
    percentile_rank: facilityScore != null && sorted.length ? percentile(sorted, facilityScore) : null,
    top_contributing_drgs: drgs.length ? drgs : undefined,
    data_source: "edge_browser_seed",
  };
}

async function qualityMonitorEdge(args: { facility_id: string }) {
  const measures = (await getQuality()).filter((q) => q.facility_id === args.facility_id);
  if (!measures.length) return { error: `no measures for ${args.facility_id}` };
  const order = (s: string) => (s === "worse" ? 0 : s === "no different" ? 1 : 2);
  const sorted = [...measures].sort((a, b) => order(a.compared_to_national) - order(b.compared_to_national));
  return {
    facility_id: args.facility_id,
    measure_count: sorted.length,
    measures: sorted.map((m) => ({
      measure_id: m.measure_id,
      measure_name: m.measure_name,
      score: m.score,
      compared_to_national: m.compared_to_national,
    })),
    data_source: "edge_browser_seed",
  };
}

async function careGapFinderEdge(args: { facility_id: string }) {
  const quality = (await getQuality()).filter((q) => q.facility_id === args.facility_id && q.compared_to_national === "worse");
  const readm = (await getReadmissions()).filter((r) => r.facility_id === args.facility_id && r.excess_readmission_ratio > 1.0);
  const gaps = [
    ...quality.map((q) => ({
      kind: "quality_measure" as const,
      measure_id: q.measure_id,
      label: q.measure_name,
      score: q.score,
      hint: HINTS[q.measure_id] ?? "Investigate workflow.",
    })),
    ...readm.map((r) => ({
      kind: "readmission_drg" as const,
      measure_id: r.measure_id,
      label: `${r.drg_description} (${r.number_of_readmissions} readmissions)`,
      excess_ratio: r.excess_readmission_ratio,
      hint: HINTS[r.measure_id] ?? "Investigate transitions of care.",
    })),
  ];
  return { facility_id: args.facility_id, gap_count: gaps.length, gaps: gaps.slice(0, 10), data_source: "edge_browser_seed" };
}

async function equityDetectorEdge(args: { measure_id: string }) {
  const facilities = await getFacilities();
  const tribalIds = new Set(facilities.filter((f) => f.tribal).map((f) => f.facility_id));
  const matches = (await getQuality()).filter((q) => q.measure_id === args.measure_id);
  if (!matches.length) return { error: `no data for ${args.measure_id}` };
  const tribalScores = matches.filter((m) => tribalIds.has(m.facility_id)).map((m) => m.score);
  const nonTribalScores = matches.filter((m) => !tribalIds.has(m.facility_id)).map((m) => m.score);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const tMean = mean(tribalScores);
  const nMean = mean(nonTribalScores);
  const gap = tMean - nMean;
  return {
    measure_id: args.measure_id,
    tribal: { n: tribalScores.length, mean: Number(tMean.toFixed(2)) },
    non_tribal: { n: nonTribalScores.length, mean: Number(nMean.toFixed(2)) },
    gap: Number(gap.toFixed(2)),
    interpretation:
      Math.abs(gap) < 1
        ? "No meaningful equity gap detected on this measure."
        : `Tribal CAH cohort scores ${gap > 0 ? "higher" : "lower"} by ${Math.abs(gap).toFixed(1)} units.`,
    data_source: "edge_browser_seed",
  };
}

async function stateRankingEdge(args: { measure_id: string; order?: "asc" | "desc" }) {
  const matches = (await getQuality()).filter((q) => q.measure_id === args.measure_id);
  if (!matches.length) return { error: `no data for ${args.measure_id}` };
  const facMap = new Map((await getFacilities()).map((f) => [f.facility_id, f.state]));
  const byState = new Map<string, number[]>();
  for (const m of matches) {
    const state = facMap.get(m.facility_id);
    if (!state) continue;
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state)!.push(m.score);
  }
  const rows = Array.from(byState.entries()).map(([state, scores]) => ({
    state,
    n: scores.length,
    mean: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));
  rows.sort((a, b) => (args.order === "desc" ? b.mean - a.mean : a.mean - b.mean));
  return {
    measure_id: args.measure_id,
    order: args.order ?? "asc",
    rankings: rows.map((r, i) => ({ rank: i + 1, state: r.state, facility_count: r.n, mean_score: Number(r.mean.toFixed(2)) })),
    data_source: "edge_browser_seed",
  };
}

async function crossCuttingAnalysisEdge(args: { measure_a: string; measure_b: string }) {
  const quality = await getQuality();
  const aMap = new Map(quality.filter((q) => q.measure_id === args.measure_a).map((q) => [q.facility_id, q.score]));
  const bMap = new Map(quality.filter((q) => q.measure_id === args.measure_b).map((q) => [q.facility_id, q.score]));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [fid, a] of aMap) {
    const b = bMap.get(fid);
    if (b != null) {
      xs.push(a);
      ys.push(b);
    }
  }
  if (xs.length < 3) return { error: `not enough paired observations (${xs.length})` };
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  const r = denom === 0 ? 0 : num / denom;
  return {
    measure_a: args.measure_a,
    measure_b: args.measure_b,
    n: xs.length,
    pearson_r: Number(r.toFixed(3)),
    interpretation:
      Math.abs(r) < 0.2
        ? "No meaningful correlation."
        : Math.abs(r) < 0.5
          ? `Weak ${r > 0 ? "positive" : "negative"} correlation.`
          : Math.abs(r) < 0.8
            ? `Moderate ${r > 0 ? "positive" : "negative"} correlation.`
            : `Strong ${r > 0 ? "positive" : "negative"} correlation.`,
    data_source: "edge_browser_seed",
  };
}

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

interface RegistryEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

function bind<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>): ToolHandler {
  return (args) => fn(args as unknown as TArgs);
}

const registry: Record<string, RegistryEntry> = {
  facility_benchmark: { definition: facilityBenchmarkDefinition, handler: bind(facilityBenchmarkEdge) },
  quality_monitor: { definition: qualityMonitorDefinition, handler: bind(qualityMonitorEdge) },
  care_gap_finder: { definition: careGapFinderDefinition, handler: bind(careGapFinderEdge) },
  equity_detector: { definition: equityDetectorDefinition, handler: bind(equityDetectorEdge) },
  state_ranking: { definition: stateRankingDefinition, handler: bind(stateRankingEdge) },
  cross_cutting_analysis: { definition: crossCuttingAnalysisDefinition, handler: bind(crossCuttingAnalysisEdge) },
};

export function listEdgeTools(): ToolDefinition[] {
  return Object.values(registry).map((r) => r.definition);
}

export async function callEdgeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const entry = registry[name];
  if (!entry) throw new Error(`Unknown tool: ${name}`);
  return await entry.handler(args);
}
