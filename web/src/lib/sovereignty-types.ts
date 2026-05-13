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
