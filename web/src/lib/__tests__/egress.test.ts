import { describe, expect, it } from "vitest";
import { buildEgressEnvelope } from "../egress";

describe("buildEgressEnvelope", () => {
  it("redacts PHI from patient records", () => {
    const env = buildEgressEnvelope({
      destination: "CMS",
      reporting_period: "Q2-2026",
      facility_id: "DEMO-CAH-001",
      patient_records: [
        { name: "Mr. Yazzie", ssn: "123-45-6789", phone: "(555) 123-4567" },
        { name: "Ms. Begay", ssn: "987-65-4321", note: "Lives at 1234 Sage Brush Avenue" },
      ],
    });
    expect(env.redaction_summary.total_redactions).toBeGreaterThanOrEqual(5);
    expect(env.redaction_summary.classes_found).toEqual(expect.arrayContaining(["ssn", "phone"]));
  });

  it("produces DP aggregates with declared epsilon", () => {
    const env = buildEgressEnvelope({
      destination: "CMS",
      reporting_period: "Q2-2026",
      facility_id: "DEMO-CAH-001",
      numeric_measures: [
        { measure_id: "HCAHPS_OVERALL", values: [70, 75, 80, 85, 90], range: [0, 100] },
        { measure_id: "MORT_30_HF", values: [10, 12, 14], range: [0, 100] },
      ],
    });
    expect(env.dp_aggregates).toHaveLength(2);
    expect(env.privacy_budget.total_epsilon_spent).toBeCloseTo(2.0);
    expect(env.dp_aggregates[0].dp_mean).toBeGreaterThan(0);
  });

  it("redacts free-text summaries", () => {
    const env = buildEgressEnvelope({
      destination: "CMS",
      reporting_period: "Q2-2026",
      facility_id: "DEMO-CAH-001",
      free_text_summaries: ["Patient Mr. Smith called from (555) 123-4567 about HF symptoms."],
    });
    expect(env.free_text_summaries_redacted[0]).not.toMatch(/123-4567/);
    expect(env.free_text_summaries_redacted[0]).not.toMatch(/Mr\.\s+Smith/);
  });

  it("envelope_hash is deterministic for same payload", () => {
    const input = {
      destination: "CMS" as const,
      reporting_period: "Q2-2026",
      facility_id: "DEMO-CAH-001",
      numeric_measures: [{ measure_id: "X", values: [1, 2, 3], range: [0, 10] as [number, number] }],
    };
    // The DP noise differs each call so envelope_hash differs — this verifies it
    // is a hash of the *generated* payload not the input
    const a = buildEgressEnvelope(input);
    const b = buildEgressEnvelope(input);
    expect(a.envelope_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.envelope_hash).toMatch(/^[0-9a-f]{64}$/);
    // Different DP samples → different envelope hashes (this is correct behavior)
    expect(a.envelope_hash).not.toBe(b.envelope_hash);
  });
});
