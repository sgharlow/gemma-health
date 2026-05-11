import { hashJson, sha256 } from "./ledger";
import { redactObject } from "./redaction";
import { aggregateMeasure, type DpAggregate } from "./dp";

export interface EgressInput {
  destination: "CMS" | "STATE_DOH" | "INTERNAL_BENCHMARK";
  reporting_period: string;
  facility_id: string;
  patient_records?: Array<Record<string, unknown>>;
  numeric_measures?: Array<{ measure_id: string; values: number[]; range: [number, number] }>;
  free_text_summaries?: string[];
}

export interface SignedEnvelope {
  destination: string;
  reporting_period: string;
  facility_id: string;
  redaction_summary: { total_redactions: number; classes_found: string[] };
  dp_aggregates: DpAggregate[];
  free_text_summaries_redacted: string[];
  patient_records_count: number;
  envelope_hash: string;
  generated_at: string;
  privacy_budget: { epsilon_per_aggregate: number; total_aggregates: number; total_epsilon_spent: number };
  notes: string;
}

const EPSILON_PER_AGGREGATE = 1.0;

export function buildEgressEnvelope(input: EgressInput): SignedEnvelope {
  const dp_aggregates = (input.numeric_measures ?? []).map((m) =>
    aggregateMeasure(m.measure_id, m.values, m.range, { epsilon: EPSILON_PER_AGGREGATE }),
  );

  let totalRedactions = 0;
  const classes = new Set<string>();
  if (input.patient_records) {
    for (const r of input.patient_records) {
      const redacted = redactObject(r);
      totalRedactions += redacted.total_redactions;
      redacted.classes_found.forEach((c) => classes.add(c));
    }
  }

  const free_text_summaries_redacted: string[] = [];
  for (const s of input.free_text_summaries ?? []) {
    const r = redactObject({ s });
    free_text_summaries_redacted.push((r.redacted as { s: string }).s);
    totalRedactions += r.total_redactions;
    r.classes_found.forEach((c) => classes.add(c));
  }

  const envelope_payload = {
    destination: input.destination,
    reporting_period: input.reporting_period,
    facility_id: input.facility_id,
    redaction_summary: { total_redactions: totalRedactions, classes_found: Array.from(classes) },
    dp_aggregates,
    free_text_summaries_redacted,
    patient_records_count: input.patient_records?.length ?? 0,
  };

  return {
    ...envelope_payload,
    envelope_hash: sha256(hashJson(envelope_payload)),
    generated_at: new Date().toISOString(),
    privacy_budget: {
      epsilon_per_aggregate: EPSILON_PER_AGGREGATE,
      total_aggregates: dp_aggregates.length,
      total_epsilon_spent: dp_aggregates.length * EPSILON_PER_AGGREGATE,
    },
    notes:
      "Built locally. PHI redacted via regex (Day 3) — Gemma E2B sub-agent verifies on Day 4. DP applied via Laplace mechanism on each numeric aggregate independently.",
  };
}
