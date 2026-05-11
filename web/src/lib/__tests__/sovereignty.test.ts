import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { evaluateEgress, clearPolicyCache } from "../sovereignty";

beforeAll(() => {
  process.env.HPE_POLICY_PATH = resolve(process.cwd(), "..", "data", "policy", "sovereignty.json");
});

afterEach(() => {
  clearPolicyCache();
});

describe("evaluateEgress (with sample policy)", () => {
  it("allows TRIBAL_COUNCIL without signature", () => {
    const r = evaluateEgress({ destination: "TRIBAL_COUNCIL" });
    expect(r.decision).toBe("allow");
  });

  it("requires signature for CMS and rejects without one", () => {
    const r = evaluateEgress({ destination: "CMS" });
    expect(r.decision).toBe("needs_signature");
    expect(r.required_signature_key_ids).toContain("tc-2026-q2");
    expect(r.signature_valid).toBe(false);
  });

  it("allows CMS with valid signature key id", () => {
    const r = evaluateEgress({ destination: "CMS", signature_key_id: "tc-2026-q2" });
    expect(r.decision).toBe("allow");
    expect(r.signature_valid).toBe(true);
  });

  it("rejects CMS with wrong signature key id", () => {
    const r = evaluateEgress({ destination: "CMS", signature_key_id: "wrong-key" });
    expect(r.decision).toBe("needs_signature");
    expect(r.signature_valid).toBe(false);
  });

  it("blocks unknown destination per default posture", () => {
    const r = evaluateEgress({ destination: "UNKNOWN_BUCKET" });
    expect(r.decision).toBe("block");
    expect(r.rationale).toMatch(/Default posture: blocked/);
  });

  it("bypasses policy when enabled=false", () => {
    const r = evaluateEgress({ destination: "UNKNOWN_BUCKET", enabled: false });
    expect(r.decision).toBe("allow");
  });
});
