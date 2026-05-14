"use client";

import { useState } from "react";

interface EnvelopeResponse {
  envelope?: {
    destination: string;
    redaction_summary: { total_redactions: number; classes_found: string[]; llm_spans_found: number };
    dp_aggregates: Array<{ metric: string; raw_mean?: number; dp_mean?: number; epsilon: number }>;
    envelope_hash: string;
    privacy_budget: { total_epsilon_spent: number };
  };
  policy?: {
    decision: "allow" | "block" | "needs_signature";
    destination: string;
    rationale: string;
    required_signature_key_ids?: string[];
  };
  ledger?: { count: number; head: string; lifetime_epsilon_spent?: number };
  error?: string;
}

interface Props {
  sovereigntyEnabled: boolean;
  onSubmit?: () => void;
}

const DESTINATIONS = ["TRIBAL_COUNCIL", "STATE_DOH", "CMS", "INTERNAL_BENCHMARK"] as const;

// Sized so the regex layer reliably strips >100 PHI fields per submission,
// keeping the voiceover claim ("over a hundred PHI fields stripped") visibly
// true on the result panel. Each record packs ~8 regex-detectable items into
// a single `note` string so total LLM calls stay low — the redaction pipeline
// invokes Gemma E2B once per string value, not once per regex match.
const DEMO_PATIENT_NAMES = [
  "Mr. Yazzie",
  "Mrs. Begay",
  "Dr. Smith",
  "Ms. Tsosie",
  "Mr. Nakai",
  "Mrs. Curley",
  "Patient Whitehorse",
  "Mr. Manygoats",
  "Ms. Etsitty",
  "Dr. Benally",
  "Mr. Yellowhair",
  "Mrs. Charley",
] as const;

const DEMO_PATIENT_RECORDS = DEMO_PATIENT_NAMES.map((name, i) => ({
  name,
  // One dense `note` string per record: SSN + phone + email + DOB + MRN +
  // address + NPI + a second titled name inside the quote. 8 deterministic
  // regex hits per record × 12 records = 96, plus the `name` field (12) = 108
  // from records alone, before LLM-found spans and free-text matches.
  note: `SSN ${100 + i * 11}-${20 + i}-${1000 + i * 137}, phone (555) ${100 + i * 7}-${4000 + i * 13}, email patient${i + 1}@hospital.test, DOB ${1 + (i % 12)}/${5 + (i % 25)}/19${50 + i}, MRN ABC${1000 + i}, address ${1000 + i * 13} Sage Brush Avenue, NPI ${1000000000 + i * 7}. Dr. Smith reviewed on ${1 + (i % 12)}/${10 + (i % 18)}/2026.`,
  dx: i % 3 === 0 ? "HF" : i % 3 === 1 ? "PN" : "AMI",
}));

const DEMO_FREE_TEXT_SUMMARIES = [
  "Patient Mr. Yazzie reported improved symptoms. Phone follow-up at (555) 123-4567 went well. Email confirmation sent to yazzie@hospital.test on 4/15/2026.",
  // LLM-layer target: quoted patient speech with embedded family name
  'Begay said "I told my husband Tom about the new meds and he asked the room-14B occupant about side effects."',
  // LLM-layer targets: indirect identifier + ad-hoc identifier
  "Yazzie returned for HF check-in on 4/12/2026; the night-shift charge nurse on Friday Feb 16 noted improved diuresis. MRN: XYZ789.",
  "Q2 patient experience: Mrs. Charley (SSN 555-44-3333, phone (555) 234-5678) rated discharge planning 9/10. DOB: 3/8/1958.",
];

// 5 numeric measures → ε = 5.0 spent (matches the egress receipt voiceover
// describing "differential privacy noise applied to 5 numeric aggregates,
// ε=5.0 spent" in docs/STORY.md scene 3).
const DEMO_NUMERIC_MEASURES = [
  { measure_id: "HCAHPS_OVERALL", values: [76, 78, 81, 84, 79], range: [0, 100] as [number, number] },
  { measure_id: "READM_30_HF", values: [11.2, 12.1, 13.5, 14.0], range: [0, 100] as [number, number] },
  { measure_id: "READM_30_AMI", values: [9.8, 10.4, 11.7, 12.3], range: [0, 100] as [number, number] },
  { measure_id: "READM_30_PN", values: [13.1, 14.6, 15.2, 16.0], range: [0, 100] as [number, number] },
  { measure_id: "SEPSIS_BUNDLE_COMPLIANCE", values: [62, 64, 65, 67, 70], range: [0, 100] as [number, number] },
];

export default function EgressButton({ sovereigntyEnabled, onSubmit }: Props) {
  const [busy, setBusy] = useState(false);
  const [destination, setDestination] = useState<string>("CMS");
  const [signature, setSignature] = useState<string>("");
  const [result, setResult] = useState<EnvelopeResponse | null>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/egress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          reporting_period: "Q2-2026",
          facility_id: "DEMO-CAH-001",
          sovereignty_mode_enabled: sovereigntyEnabled,
          signature_key_id: signature || undefined,
          patient_records: DEMO_PATIENT_RECORDS,
          numeric_measures: DEMO_NUMERIC_MEASURES,
          free_text_summaries: DEMO_FREE_TEXT_SUMMARIES,
        }),
      });
      const data = (await res.json()) as EnvelopeResponse;
      setResult(data);
      onSubmit?.();
    } finally {
      setBusy(false);
    }
  }

  const blocked = result?.policy && result.policy.decision !== "allow";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Egress gate (redaction → DP → policy → sign)
          </h2>
          <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
            {DEMO_PATIENT_RECORDS.length} patient records + {DEMO_NUMERIC_MEASURES.length} measures + {DEMO_FREE_TEXT_SUMMARIES.length} free-text summaries —
            mix of regex-easy (titles, SSN, phone, address, DOB, MRN, NPI, email) and LLM-only
            (surnames without honorifics, indirect identifiers, quoted speech). Watch the gate split them.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor="egress-destination" className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
            Destination
            <select
              id="egress-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="ml-2 rounded border border-amber-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-800 dark:bg-zinc-900"
            >
              {DESTINATIONS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label htmlFor="egress-signature" className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
            Signature key
            <input
              id="egress-signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="e.g. tc-2026-q2"
              className="ml-2 w-32 rounded border border-amber-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-800 dark:bg-zinc-900"
            />
          </label>
          <button
            onClick={submit}
            disabled={busy}
            aria-busy={busy}
            className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {busy ? "Working…" : "Submit Q2 to CMS"}
          </button>
        </div>
      </div>

      {blocked && result?.policy && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <div className="font-semibold">Sovereignty Mode {result.policy.decision === "block" ? "BLOCKED" : "REQUIRES SIGNATURE"}</div>
          <div>{result.policy.rationale}</div>
          {result.policy.required_signature_key_ids && (
            <div className="mt-1">
              Authorized signature key IDs:{" "}
              <code>{result.policy.required_signature_key_ids.join(", ")}</code>
            </div>
          )}
        </div>
      )}

      {result?.envelope && (
        <div className="space-y-2 text-xs">
          <div className="rounded bg-white p-2 dark:bg-zinc-900">
            <span className="font-medium">Redaction:</span>{" "}
            <span className="text-emerald-700 dark:text-emerald-400">
              {result.envelope.redaction_summary.total_redactions} fields stripped
            </span>{" "}
            ({result.envelope.redaction_summary.classes_found.join(", ")}) ·{" "}
            <span className="text-emerald-700 dark:text-emerald-400">
              {result.envelope.redaction_summary.llm_spans_found} LLM-only spans
            </span>{" "}
            <span className="text-amber-700 dark:text-amber-300" title="Regex catches deterministic patterns; the LLM layer catches indirect identifiers regex can't reliably flag.">
              (regex caught {result.envelope.redaction_summary.total_redactions - result.envelope.redaction_summary.llm_spans_found}, LLM caught {result.envelope.redaction_summary.llm_spans_found} extra)
            </span>
          </div>
          <div className="rounded bg-white p-2 dark:bg-zinc-900">
            <span className="font-medium">DP aggregates:</span>{" "}
            {result.envelope.dp_aggregates.map((a) => (
              <span key={a.metric} className="mr-3">
                {a.metric}: {a.raw_mean} → {a.dp_mean} (ε={a.epsilon})
              </span>
            ))}
          </div>
          <div className="rounded bg-white p-2 dark:bg-zinc-900">
            <span className="font-medium">Privacy budget spent (this envelope):</span>{" "}
            ε={result.envelope.privacy_budget.total_epsilon_spent}
            {result.ledger?.lifetime_epsilon_spent !== undefined && (
              <span className="ml-3 text-zinc-600 dark:text-zinc-400">
                · lifetime ε in ledger: {result.ledger.lifetime_epsilon_spent.toFixed(2)}
              </span>
            )}
          </div>
          <div className="rounded bg-white p-2 dark:bg-zinc-900">
            <span className="font-medium">Envelope hash:</span>{" "}
            <code className="text-zinc-600 dark:text-zinc-400">
              {result.envelope.envelope_hash.slice(0, 24)}…
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
