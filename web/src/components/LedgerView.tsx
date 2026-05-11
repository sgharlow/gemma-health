"use client";

import { useEffect, useState } from "react";

interface LedgerEntry {
  seq: number;
  ts: string;
  action: string;
  tool_name?: string;
  notes?: string;
  phi_egress: boolean;
  this_hash: string;
  prev_hash: string;
}

interface LedgerResponse {
  count: number;
  head: string;
  verification: { valid: boolean; checked: number; brokenAt?: number; reason?: string };
  entries: LedgerEntry[];
}

export default function LedgerView({ refreshSignal }: { refreshSignal?: number }) {
  const [data, setData] = useState<LedgerResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ledger?limit=10")
      .then((r) => r.json())
      .then((d: LedgerResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-xs text-zinc-500 dark:border-zinc-700">
        Compliance ledger loading…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Compliance Ledger
        </h2>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={`rounded px-2 py-0.5 font-medium ${
              data.verification.valid
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {data.verification.valid ? "chain verified" : `BROKEN at seq ${data.verification.brokenAt}`}
          </span>
          <span className="text-zinc-500">
            {data.count} total · head <code>{data.head.slice(0, 12)}…</code>
          </span>
        </div>
      </div>

      {data.entries.length === 0 ? (
        <p className="text-xs text-zinc-500">No entries yet. Send a chat message to populate the ledger.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.entries.slice().reverse().map((e) => (
            <li
              key={e.seq}
              className="flex items-start gap-3 rounded border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span className="font-mono text-zinc-400">#{e.seq.toString().padStart(3, "0")}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-medium ${
                  e.action === "egress"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : e.action === "tool_call"
                      ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {e.action}
                {e.tool_name ? `:${e.tool_name}` : ""}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 font-medium ${
                  e.phi_egress
                    ? "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                phi_egress: {e.phi_egress ? "true (signed)" : "false"}
              </span>
              <span className="flex-1 truncate text-zinc-600 dark:text-zinc-400">{e.notes ?? ""}</span>
              <span className="font-mono text-zinc-400">{e.this_hash.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
