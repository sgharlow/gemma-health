/**
 * MCP-side implementations of the 6 HealthPulse Edge tools.
 *
 * These are pure JS ports of the web-side TypeScript tools — same contracts,
 * same returned shapes. The on-prem web app, the in-browser /edge demo, and
 * this MCP server are three surfaces over the same logical tool set. If
 * you're tempted to change a contract here, change all three or none.
 */

const { load } = require("./data");

const HINTS = {
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

const METRIC_MAP = {
  readmission_rate_30d_hf: { source: "readmissions", measure_id: "READM_30_HF", unit: "%" },
  ed_throughput: { source: "quality", measure_id: "ED_THROUGHPUT", unit: "minutes" },
  hcahps_overall: { source: "quality", measure_id: "HCAHPS_OVERALL", unit: "% top-box" },
  mortality_30d_hf: { source: "quality", measure_id: "MORT_30_HF", unit: "%" },
};

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] !== undefined ? (sorted[base + 1] - sorted[base]) * rest : 0);
}

function percentile(sorted, value) {
  if (sorted.length === 0) return 0;
  let count = 0;
  for (const v of sorted) if (v <= value) count++;
  return Math.round((count / sorted.length) * 100);
}

function facilityBenchmark(args) {
  const cfg = METRIC_MAP[args.metric];
  if (!cfg) return { error: `unknown metric: ${args.metric}` };
  const { facilities, quality, readmissions } = load();
  const f = facilities.find((x) => x.facility_id === args.facility_id);
  if (!f) return { error: `facility not found: ${args.facility_id}` };

  let facilityScore = null;
  let peerScores = [];
  let contributingDrgs = [];

  if (cfg.source === "readmissions") {
    const fRows = readmissions.filter((r) => r.facility_id === args.facility_id && r.measure_id === cfg.measure_id);
    facilityScore = fRows.length > 0 ? Number(fRows[0].predicted_readmission_rate) : null;
    peerScores = readmissions
      .filter((r) => r.measure_id === cfg.measure_id && r.facility_id !== args.facility_id)
      .filter((r) => facilities.find((x) => x.facility_id === r.facility_id)?.cms_region === f.cms_region)
      .map((r) => Number(r.predicted_readmission_rate));
    contributingDrgs = readmissions
      .filter((r) => r.facility_id === args.facility_id)
      .sort((a, b) => b.excess_readmission_ratio - a.excess_readmission_ratio)
      .slice(0, 3)
      .map((d) => ({
        drg: d.drg,
        description: d.drg_description,
        excess_ratio: Number(d.excess_readmission_ratio),
        n: Number(d.number_of_readmissions),
      }));
  } else {
    const fRows = quality.filter((q) => q.facility_id === args.facility_id && q.measure_id === cfg.measure_id);
    facilityScore = fRows.length > 0 ? Number(fRows[0].score) : null;
    peerScores = quality
      .filter((q) => q.measure_id === cfg.measure_id && q.facility_id !== args.facility_id)
      .filter((q) => facilities.find((x) => x.facility_id === q.facility_id)?.cms_region === f.cms_region)
      .map((q) => Number(q.score));
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
    top_contributing_drgs: contributingDrgs.length > 0 ? contributingDrgs : undefined,
    data_source: "demo_seed",
  };
}

function qualityMonitor(args) {
  const { quality } = load();
  const order = { worse: 0, "no different": 1, better: 2 };
  const rows = quality
    .filter((q) => q.facility_id === args.facility_id)
    .sort((a, b) => order[a.compared_to_national] - order[b.compared_to_national]);
  if (rows.length === 0) return { error: `no quality data for facility ${args.facility_id}` };
  return {
    facility_id: args.facility_id,
    measure_count: rows.length,
    measures: rows.map((r) => ({
      measure_id: r.measure_id,
      measure_name: r.measure_name,
      score: Number(r.score),
      compared_to_national: r.compared_to_national,
    })),
    data_source: "demo_seed",
  };
}

function careGapFinder(args) {
  const { quality, readmissions } = load();
  const qg = quality
    .filter((q) => q.facility_id === args.facility_id && q.compared_to_national === "worse")
    .sort((a, b) => b.score - a.score);
  const rg = readmissions
    .filter((r) => r.facility_id === args.facility_id && r.excess_readmission_ratio > 1.0)
    .sort((a, b) => b.excess_readmission_ratio - a.excess_readmission_ratio);
  const gaps = [
    ...qg.map((q) => ({
      kind: "quality_measure",
      measure_id: q.measure_id,
      label: q.measure_name,
      score: Number(q.score),
      hint: HINTS[q.measure_id] ?? "Investigate workflow and documentation for this measure.",
    })),
    ...rg.map((r) => ({
      kind: "readmission_drg",
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

function equityDetector(args) {
  const { facilities, quality } = load();
  const rows = quality.filter((q) => q.measure_id === args.measure_id);
  if (rows.length === 0) return { error: `no data for measure ${args.measure_id}` };
  const byFac = new Map(facilities.map((f) => [f.facility_id, f]));
  const tribal = [];
  const nonTribal = [];
  for (const r of rows) {
    const fac = byFac.get(r.facility_id);
    if (!fac) continue;
    (fac.tribal ? tribal : nonTribal).push(Number(r.score));
  }
  const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const tMean = mean(tribal);
  const nMean = mean(nonTribal);
  const gap = tMean - nMean;
  return {
    measure_id: args.measure_id,
    tribal: { n: tribal.length, mean: Number(tMean.toFixed(2)) },
    non_tribal: { n: nonTribal.length, mean: Number(nMean.toFixed(2)) },
    gap: Number(gap.toFixed(2)),
    interpretation:
      tribal.length === 0 || nonTribal.length === 0
        ? "Insufficient data in one of the cohorts."
        : Math.abs(gap) < 1
          ? "No meaningful equity gap detected on this measure."
          : `Tribal CAH cohort scores ${gap > 0 ? "higher" : "lower"} by ${Math.abs(gap).toFixed(1)} units. Direction of "better" depends on the measure.`,
    data_source: "demo_seed",
  };
}

function stateRanking(args) {
  const { facilities, quality } = load();
  const rows = quality.filter((q) => q.measure_id === args.measure_id);
  if (rows.length === 0) return { error: `no data for measure ${args.measure_id}` };
  const byFac = new Map(facilities.map((f) => [f.facility_id, f]));
  const byState = new Map();
  for (const r of rows) {
    const f = byFac.get(r.facility_id);
    if (!f) continue;
    if (!byState.has(f.state)) byState.set(f.state, []);
    byState.get(f.state).push(Number(r.score));
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const rows2 = Array.from(byState.entries())
    .map(([state, scores]) => ({ state, n_facilities: scores.length, mean_score: Number(mean(scores).toFixed(2)) }))
    .sort((a, b) => (args.order === "asc" ? a.mean_score - b.mean_score : b.mean_score - a.mean_score))
    .map((r, i) => ({ rank: i + 1, ...r }));
  return {
    measure_id: args.measure_id,
    order: args.order ?? "desc",
    rankings: rows2,
    data_source: "demo_seed",
  };
}

function crossCuttingAnalysis(args) {
  const { quality } = load();
  const a = new Map();
  const b = new Map();
  for (const q of quality) {
    if (q.measure_id === args.measure_a) a.set(q.facility_id, Number(q.score));
    if (q.measure_id === args.measure_b) b.set(q.facility_id, Number(q.score));
  }
  const paired = [];
  for (const [id, av] of a) {
    if (b.has(id)) paired.push([av, b.get(id)]);
  }
  if (paired.length < 3) return { error: `not enough paired data (n=${paired.length})` };
  const n = paired.length;
  const meanA = paired.reduce((s, p) => s + p[0], 0) / n;
  const meanB = paired.reduce((s, p) => s + p[1], 0) / n;
  let num = 0;
  let dA = 0;
  let dB = 0;
  for (const [av, bv] of paired) {
    num += (av - meanA) * (bv - meanB);
    dA += (av - meanA) ** 2;
    dB += (bv - meanB) ** 2;
  }
  const r = num / Math.sqrt(dA * dB);
  return {
    measure_a: args.measure_a,
    measure_b: args.measure_b,
    n,
    pearson_r: Number(r.toFixed(3)),
    data_source: "demo_seed",
  };
}

const TOOL_DEFINITIONS = [
  {
    name: "facility_benchmark",
    description:
      "Compare a Critical Access Hospital's performance on a quality metric against peer CAHs in the same CMS region. Returns the facility's score, peer percentiles, and (for readmission metrics) the contributing DRGs.",
    inputSchema: {
      type: "object",
      properties: {
        facility_id: { type: "string", description: "Facility ID, e.g. 'DEMO-CAH-001'" },
        metric: {
          type: "string",
          enum: ["readmission_rate_30d_hf", "ed_throughput", "hcahps_overall", "mortality_30d_hf"],
        },
      },
      required: ["facility_id", "metric"],
    },
  },
  {
    name: "quality_monitor",
    description: "Return all quality measures for a facility, sorted worse → no different → better.",
    inputSchema: {
      type: "object",
      properties: { facility_id: { type: "string" } },
      required: ["facility_id"],
    },
  },
  {
    name: "care_gap_finder",
    description:
      "Find the most actionable care gaps at a facility — measures where the score is worse than national, plus DRGs with excess readmission ratio > 1.0. Returns ranked, with a one-sentence intervention hint per gap.",
    inputSchema: {
      type: "object",
      properties: { facility_id: { type: "string" } },
      required: ["facility_id"],
    },
  },
  {
    name: "equity_detector",
    description: "Compare outcomes between tribal CAHs and non-tribal CAHs on a given measure, surfacing the equity gap.",
    inputSchema: {
      type: "object",
      properties: { measure_id: { type: "string", description: "e.g. 'HCAHPS_OVERALL'" } },
      required: ["measure_id"],
    },
  },
  {
    name: "state_ranking",
    description: "Rank states by mean CAH score on a given quality measure.",
    inputSchema: {
      type: "object",
      properties: {
        measure_id: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"], default: "desc" },
      },
      required: ["measure_id"],
    },
  },
  {
    name: "cross_cutting_analysis",
    description: "Compute Pearson correlation between two quality measures across all CAHs with paired data.",
    inputSchema: {
      type: "object",
      properties: {
        measure_a: { type: "string" },
        measure_b: { type: "string" },
      },
      required: ["measure_a", "measure_b"],
    },
  },
];

const TOOL_HANDLERS = {
  facility_benchmark: facilityBenchmark,
  quality_monitor: qualityMonitor,
  care_gap_finder: careGapFinder,
  equity_detector: equityDetector,
  state_ranking: stateRanking,
  cross_cutting_analysis: crossCuttingAnalysis,
};

module.exports = { TOOL_DEFINITIONS, TOOL_HANDLERS };
