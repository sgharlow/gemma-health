import { describe, expect, it } from "vitest";
import { facilityBenchmark } from "../tools/facility-benchmark";
import { qualityMonitor } from "../tools/quality-monitor";
import { careGapFinder } from "../tools/care-gap-finder";
import { equityDetector } from "../tools/equity-detector";
import { stateRanking } from "../tools/state-ranking";
import { crossCuttingAnalysis } from "../tools/cross-cutting-analysis";

describe("facility_benchmark", () => {
  it("returns score + percentile rank for a known facility + readmission metric", async () => {
    const r = await facilityBenchmark({ facility_id: "DEMO-CAH-001", metric: "readmission_rate_30d_hf" });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.facility_score).toBeGreaterThan(0);
    expect(r.peer_count).toBeGreaterThan(0);
    expect(r.percentile_rank).toBeGreaterThanOrEqual(0);
    expect(r.percentile_rank).toBeLessThanOrEqual(100);
    expect(r.top_contributing_drgs).toBeDefined();
  });

  it("returns score for HCAHPS quality metric", async () => {
    const r = await facilityBenchmark({ facility_id: "DEMO-CAH-003", metric: "hcahps_overall" });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.facility_score).toBe(86);
    expect(r.unit).toBe("% top-box");
  });

  it("errors on unknown facility", async () => {
    const r = await facilityBenchmark({ facility_id: "DOES-NOT-EXIST", metric: "hcahps_overall" });
    expect("error" in r).toBe(true);
  });
});

describe("quality_monitor", () => {
  it("returns measures sorted by 'worse' first", async () => {
    const r = await qualityMonitor({ facility_id: "DEMO-CAH-004" });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.measure_count).toBeGreaterThan(0);
    expect(r.measures[0].compared_to_national).toBe("worse");
  });
});

describe("care_gap_finder", () => {
  it("flags worse-than-national measures and excess readmission DRGs", async () => {
    const r = await careGapFinder({ facility_id: "DEMO-CAH-004" });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.gap_count).toBeGreaterThan(0);
    const kinds = new Set(r.gaps.map((g) => g.kind));
    expect(kinds.size).toBeGreaterThan(0);
    expect(r.gaps[0].hint).toBeTypeOf("string");
  });

  it("returns empty gap list for a strong facility", async () => {
    const r = await careGapFinder({ facility_id: "DEMO-CAH-014" });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.gap_count).toBe(0);
  });
});

describe("equity_detector", () => {
  it("returns tribal vs non-tribal cohort means for HCAHPS", async () => {
    const r = await equityDetector({ measure_id: "HCAHPS_OVERALL" });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.tribal.n).toBeGreaterThan(0);
    expect(r.non_tribal.n).toBeGreaterThan(0);
    expect(typeof r.gap).toBe("number");
    expect(typeof r.interpretation).toBe("string");
  });
});

describe("state_ranking", () => {
  it("returns states ranked by HCAHPS mean", async () => {
    const r = await stateRanking({ measure_id: "HCAHPS_OVERALL", order: "desc" });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.rankings.length).toBeGreaterThan(0);
    expect(r.rankings[0].rank).toBe(1);
    for (let i = 1; i < r.rankings.length; i++) {
      expect(r.rankings[i].mean_score).toBeLessThanOrEqual(r.rankings[i - 1].mean_score);
    }
  });
});

describe("cross_cutting_analysis", () => {
  it("computes pearson r between two measures with enough paired data", async () => {
    const r = await crossCuttingAnalysis({ measure_a: "HCAHPS_OVERALL", measure_b: "MORT_30_HF" });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(typeof r.pearson_r).toBe("number");
    expect(Math.abs(r.pearson_r)).toBeLessThanOrEqual(1);
    expect(r.n).toBeGreaterThanOrEqual(3);
  });
});
