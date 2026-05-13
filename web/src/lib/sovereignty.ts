import { DEFAULT_POLICY } from "../data/sovereignty-policy";
import type { SovereigntyPolicy, PolicyEvaluation } from "./sovereignty-types";

export type { SovereigntyPolicy, DestinationPolicy, PolicyEvaluation } from "./sovereignty-types";

let cached: SovereigntyPolicy | null = null;
let override: SovereigntyPolicy | null = null;

export function loadPolicy(): SovereigntyPolicy {
  if (override) return override;
  if (cached) return cached;
  cached = DEFAULT_POLICY;
  return cached;
}

export function clearPolicyCache(): void {
  cached = null;
}

/**
 * Test hook — lets the test suite swap in an alternate policy without
 * touching the file system. Production code never calls this; on the Mac
 * the on-prem operator can replace `DEFAULT_POLICY` at build time by
 * editing `web/src/data/sovereignty-policy.ts`.
 */
export function setPolicyForTesting(p: SovereigntyPolicy | null): void {
  override = p;
  cached = null;
}

export function evaluateEgress(args: {
  destination: string;
  signature_key_id?: string;
  enabled?: boolean;
}): PolicyEvaluation {
  const policy = loadPolicy();

  if (args.enabled === false) {
    return {
      decision: "allow",
      destination: args.destination,
      jurisdiction: policy.jurisdiction,
      rationale: "Sovereignty Mode disabled — no policy enforcement.",
    };
  }

  const dest = policy.destinations[args.destination];
  if (!dest) {
    return {
      decision: policy.default_egress_posture === "allowed" ? "allow" : "block",
      destination: args.destination,
      jurisdiction: policy.jurisdiction,
      rationale: `Destination '${args.destination}' not declared in policy. Default posture: ${policy.default_egress_posture}.`,
    };
  }

  if (!dest.allowed) {
    return {
      decision: "block",
      destination: args.destination,
      jurisdiction: policy.jurisdiction,
      rationale: dest.rationale || "Destination explicitly blocked by policy.",
    };
  }

  if (dest.requires_signature) {
    const provided = args.signature_key_id;
    const valid = !!provided && policy.authorized_signature_key_ids.includes(provided);
    return {
      decision: valid ? "allow" : "needs_signature",
      destination: args.destination,
      jurisdiction: policy.jurisdiction,
      rationale: dest.rationale,
      required_signature_key_ids: policy.authorized_signature_key_ids,
      signature_provided: provided,
      signature_valid: valid,
    };
  }

  return {
    decision: "allow",
    destination: args.destination,
    jurisdiction: policy.jurisdiction,
    rationale: dest.rationale,
  };
}
