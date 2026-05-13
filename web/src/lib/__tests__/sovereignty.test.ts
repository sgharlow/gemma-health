import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateEgress, clearPolicyCache, setPolicyForTesting } from "../sovereignty";
import { DEFAULT_POLICY } from "../../data/sovereignty-policy";
import type { SovereigntyPolicy } from "../sovereignty-types";

afterEach(() => {
  setPolicyForTesting(null);
  clearPolicyCache();
});

describe("evaluateEgress (with default in-bundle policy)", () => {
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

describe("policy file ↔ bundled policy parity", () => {
  // The canonical policy lives in `data/policy/sovereignty.json` (what a
  // tribal council would ship to the on-prem box). The runtime uses the
  // bundled copy in `web/src/data/sovereignty-policy.ts`. The two MUST
  // declare the same destinations and signature keys, or the Vercel
  // /api/egress response will diverge from the on-prem one.
  it("matches data/policy/sovereignty.json (canonical)", () => {
    const path = resolve(process.cwd(), "..", "data", "policy", "sovereignty.json");
    const onDisk = JSON.parse(readFileSync(path, "utf8")) as SovereigntyPolicy;

    expect(DEFAULT_POLICY.version).toBe(onDisk.version);
    expect(DEFAULT_POLICY.jurisdiction).toBe(onDisk.jurisdiction);
    expect(DEFAULT_POLICY.default_egress_posture).toBe(onDisk.default_egress_posture);
    expect(DEFAULT_POLICY.authorized_signature_key_ids).toEqual(onDisk.authorized_signature_key_ids);
    expect(Object.keys(DEFAULT_POLICY.destinations).sort()).toEqual(
      Object.keys(onDisk.destinations).sort(),
    );
    for (const [name, d] of Object.entries(DEFAULT_POLICY.destinations)) {
      expect(d.allowed).toBe(onDisk.destinations[name].allowed);
      expect(d.requires_signature).toBe(onDisk.destinations[name].requires_signature);
    }
  });
});

describe("setPolicyForTesting hook", () => {
  it("swaps in an alternate policy and reverts cleanly", () => {
    const allowAll: SovereigntyPolicy = {
      version: "test-allow-all",
      jurisdiction: "test",
      framework_basis: [],
      default_egress_posture: "allowed",
      destinations: {
        ANYWHERE: { allowed: true, requires_signature: false, rationale: "test" },
      },
      authorized_signature_key_ids: [],
    };
    setPolicyForTesting(allowAll);
    expect(evaluateEgress({ destination: "ANYWHERE" }).decision).toBe("allow");
    expect(evaluateEgress({ destination: "RANDOM" }).decision).toBe("allow");

    setPolicyForTesting(null);
    expect(evaluateEgress({ destination: "CMS" }).decision).toBe("needs_signature");
  });
});
