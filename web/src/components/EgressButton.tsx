"use client";

import { useState } from "react";

interface EnvelopeResponse {
  envelope?: {
    destination: string;
    redaction_summary: { total_redactions: number; classes_found: string[] };
    dp_aggregates: Array<{ metric: string; raw_mean?: number; dp_mean?: number; epsilon: number }>;
    envelope_hash: string;
    privacy_budget: { total_epsilon_spent: number };
  };
  error?: string;
}

export default function EgressButton({ onSubmit }: { onSubmit?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnvelopeResponse | null>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/egress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: "CMS",
          reporting_period: "Q2-2026",
          facility_id: "DEMO-CAH-001",
          patient_records: [
            { name: "Mr. Yazzie", ssn: "123-45-6789", phone: "(555) 123-4567", dx: "HF" },
            { name: "Ms. Begay", ssn: "987-65-4321", note: "Lives at 1234 Sage Brush Avenue" },
            { name: "Dr. Smith", phone: "(555) 999-1111", dx: "PN" },
          ],
          numeric_measures: [
            { measure_id: "HCAHPS_OVERALL", values: [76, 78, 81, 84, 79], range: [0, 100] },
            { measure_id: "READM_30_HF", values: [11.2, 12.1, 13.5, 14.0], range: [0, 100] },
          ],
          free_text_summaries: [
            "Patient Mr. Yazzie reported improved symptoms after discharge. Phone follow-up at (555) 123-4567 went well.",
          ],
        }),
      });
      const data = (await res.json()) as EnvelopeResponse;
      setResult(data);
      onSubmit?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Submit Q2 to CMS (egress gate)
        </h2>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Redacting + signing…" : "Build redacted envelope"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
        Demo payload: 3 patient records (with synthetic PHI) + 2 numeric measures. Pass through redaction → DP → ledger sign.
      </p>
      {result?.envelope && (
        <div className="mt-3 space-y-2 text-xs">
          <div className="rounded bg-white p-2 dark:bg-zinc-900">
            <span className="font-medium">Redaction:</span>{" "}
            <span className="text-emerald-700 dark:text-emerald-400">
              {result.envelope.redaction_summary.total_redactions} fields stripped
            </span>{" "}
            ({result.envelope.redaction_summary.classes_found.join(", ")})
          </div>
          <div className="rounded bg-white p-2 dark:bg-zinc-900">
            <span className="font-medium">DP aggregates:</span>{" "}
            {result.envelope.dp_aggregates.map((a) => (
              <span key={a.metric} className="mr-3">
                {a.metric}: raw {a.raw_mean} → noised {a.dp_mean} (ε={a.epsilon})
              </span>
            ))}
          </div>
          <div className="rounded bg-white p-2 dark:bg-zinc-900">
            <span className="font-medium">Privacy budget spent:</span>{" "}
            ε={result.envelope.privacy_budget.total_epsilon_spent}
          </div>
          <div className="rounded bg-white p-2 dark:bg-zinc-900">
            <span className="font-medium">Envelope hash:</span>{" "}
            <code className="text-zinc-600">{result.envelope.envelope_hash.slice(0, 24)}…</code>
          </div>
        </div>
      )}
      {result?.error && (
        <p className="mt-2 text-xs text-red-700">Error: {result.error}</p>
      )}
    </div>
  );
}
