/**
 * Runtime copy of `data/policy/sovereignty.json`.
 *
 * Why a TS module and not a file read: `/api/egress` on Vercel cannot rely on
 * `process.cwd() + ".." + "/data/policy/..."` resolving to the right file in
 * the serverless function bundle. Bundling the JSON as a TS const keeps the
 * Mac on-prem path and the Vercel demo path identical and removes a class of
 * environment-specific failures.
 *
 * The JSON file under `data/policy/sovereignty.json` is preserved as the
 * canonical example a tribal council would ship to the on-prem box. The two
 * MUST stay in sync — `__tests__/sovereignty.test.ts` covers parity.
 */

import type { SovereigntyPolicy } from "../lib/sovereignty-types";

export const DEFAULT_POLICY: SovereigntyPolicy = {
  version: "2026-05-10",
  jurisdiction: "Navajo Nation",
  framework_basis: ["CARE Principles for Indigenous Data Governance", "HIPAA", "42 CFR Part 2"],
  default_egress_posture: "blocked",
  destinations: {
    INTERNAL_BENCHMARK: {
      allowed: true,
      requires_signature: false,
      rationale:
        "Federated peer benchmarks across CAHs in the cohort; differential-privacy aggregates only, never raw records.",
    },
    TRIBAL_COUNCIL: {
      allowed: true,
      requires_signature: false,
      rationale:
        "On-jurisdiction reporting to the tribal health authority. Plain-text aggregates permitted; PHI still redacted.",
    },
    STATE_DOH: {
      allowed: true,
      requires_signature: true,
      rationale:
        "State Department of Health (Arizona). Requires tribal council co-signature key tc-2026-q2.",
    },
    CMS: {
      allowed: true,
      requires_signature: true,
      rationale:
        "Federal reporting. Allowed in DP-aggregated form only; tribal council co-signature key tc-2026-q2 required for the reporting period.",
    },
  },
  authorized_signature_key_ids: ["tc-2026-q2"],
  notes:
    "This is a sample policy. In production, a tribal council updates it through their own governance process and ships it to the box. The application enforces it; the application does not author it.",
};
