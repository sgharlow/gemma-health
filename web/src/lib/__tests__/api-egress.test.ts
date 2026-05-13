/**
 * End-to-end test of /api/egress against the actual route handler.
 *
 * Imports the handler directly and invokes it with a synthetic Request — no
 * dev server needed. Catches Vercel-path regressions and sovereignty wiring
 * issues that the lib-level egress.test.ts can't see.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "../../app/api/egress/route";

beforeAll(() => {
  process.env.STUB_LLM_REDACTION = "true";
});

function postEgress(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new Request("http://localhost/api/egress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/egress (integration)", () => {
  it("blocks CMS egress without signature (status 403, sovereignty rationale)", async () => {
    const res = await postEgress({
      destination: "CMS",
      reporting_period: "Q2-2026",
      facility_id: "DEMO-CAH-001",
      sovereignty_mode_enabled: true,
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      policy: { decision: string; rationale: string; required_signature_key_ids?: string[] };
    };
    expect(body.policy.decision).toBe("needs_signature");
    expect(body.policy.required_signature_key_ids).toContain("tc-2026-q2");
  });

  it("allows CMS egress with the tribal-council signature key and returns a signed envelope", async () => {
    const res = await postEgress({
      destination: "CMS",
      reporting_period: "Q2-2026",
      facility_id: "DEMO-CAH-001",
      sovereignty_mode_enabled: true,
      signature_key_id: "tc-2026-q2",
      patient_records: [{ name: "Mr. Yazzie", ssn: "123-45-6789" }],
      numeric_measures: [
        { measure_id: "HCAHPS_OVERALL", values: [70, 75, 80], range: [0, 100] },
      ],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      envelope: { redaction_summary: { total_redactions: number }; envelope_hash: string; privacy_budget: { total_epsilon_spent: number } };
      policy: { decision: string };
      ledger: { lifetime_epsilon_spent: number };
    };
    expect(body.policy.decision).toBe("allow");
    expect(body.envelope.redaction_summary.total_redactions).toBeGreaterThanOrEqual(2);
    expect(body.envelope.envelope_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.envelope.privacy_budget.total_epsilon_spent).toBeCloseTo(1.0);
    // Ledger may persist (Mac) or be in-memory (Vercel) — either way lifetime
    // epsilon is at least what this request just spent.
    expect(body.ledger.lifetime_epsilon_spent).toBeGreaterThanOrEqual(1.0);
  });

  it("rejects unknown destination with default-blocked posture (status 403)", async () => {
    const res = await postEgress({
      destination: "RANDOM_BUCKET",
      reporting_period: "Q2-2026",
      facility_id: "DEMO-CAH-001",
      sovereignty_mode_enabled: true,
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { policy: { decision: string; rationale: string } };
    expect(body.policy.decision).toBe("block");
    expect(body.policy.rationale).toMatch(/Default posture: blocked/);
  });

  it("bypasses policy when sovereignty_mode_enabled=false (status 200)", async () => {
    const res = await postEgress({
      destination: "RANDOM_BUCKET",
      reporting_period: "Q2-2026",
      facility_id: "DEMO-CAH-001",
      sovereignty_mode_enabled: false,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { policy: { decision: string } };
    expect(body.policy.decision).toBe("allow");
  });

  it("rejects malformed body with 400", async () => {
    const res = await postEgress({});
    expect(res.status).toBe(400);
  });
});
