import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const POLICY_PATH =
  process.env.HPE_POLICY_PATH ?? resolve(process.cwd(), "..", "data", "policy", "sovereignty.json");

export interface DestinationPolicy {
  allowed: boolean;
  requires_signature: boolean;
  rationale: string;
}

export interface SovereigntyPolicy {
  version: string;
  jurisdiction: string;
  framework_basis: string[];
  default_egress_posture: "allowed" | "blocked";
  destinations: Record<string, DestinationPolicy>;
  authorized_signature_key_ids: string[];
  notes?: string;
}

export interface PolicyEvaluation {
  decision: "allow" | "block" | "needs_signature";
  destination: string;
  jurisdiction: string;
  rationale: string;
  required_signature_key_ids?: string[];
  signature_provided?: string;
  signature_valid?: boolean;
}

let cached: SovereigntyPolicy | null = null;

export function loadPolicy(): SovereigntyPolicy {
  if (cached) return cached;
  if (!existsSync(POLICY_PATH)) {
    cached = {
      version: "default",
      jurisdiction: "unconfigured",
      framework_basis: [],
      default_egress_posture: "blocked",
      destinations: {},
      authorized_signature_key_ids: [],
      notes: `No policy file at ${POLICY_PATH}; defaulting to blocked.`,
    };
    return cached;
  }
  cached = JSON.parse(readFileSync(POLICY_PATH, "utf8")) as SovereigntyPolicy;
  return cached;
}

export function clearPolicyCache(): void {
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
