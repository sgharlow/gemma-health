"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadEdgeLlm,
  checkWebGpu,
  setSimulatedOverride,
  isSimulatedActive,
  type LoadProgress,
} from "@/lib/edge-llm";
import { callEdgeTool } from "@/lib/tools-edge";
import {
  BrowserLedger,
  verifyBrowserChain,
  type BrowserLedgerEntry,
  type BrowserChainVerification,
} from "@/lib/ledger-browser";
import { getFacilities } from "@/lib/edge-data";

interface Facility {
  facility_id: string;
  facility_name: string;
  state: string;
  tribal: boolean;
}

interface CareGap {
  kind: "quality_measure" | "readmission_drg";
  measure_id: string;
  label: string;
  score?: number;
  excess_ratio?: number;
  hint: string;
}

interface CareGapResult {
  facility_id: string;
  gap_count: number;
  gaps: CareGap[];
  data_source: string;
}

const SUMMARY_PROMPT = `You are HealthPulse Edge running in a browser tab. You receive a JSON summary of one CAH's care-gap analysis and write a 2-sentence executive summary for the quality coordinator. Cite the highest-leverage gap and the recommended intervention. Be concise. No PHI.

Input:`;

const PREVIEW_FACILITY_ID = "DEMO-CAH-001";

const DEMO_YOUTUBE_URL = process.env.NEXT_PUBLIC_DEMO_YOUTUBE_URL ?? "";

export default function EdgePage() {
  const [networkOnline, setNetworkOnline] = useState(true);
  const [gpu, setGpu] = useState<{ supported: boolean; reason?: string } | null>(null);
  const [load, setLoad] = useState<LoadProgress>({ state: "idle" });
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selected, setSelected] = useState<string>(PREVIEW_FACILITY_ID);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [streaming, setStreaming] = useState<string>("");
  const [ledgerEntries, setLedgerEntries] = useState<BrowserLedgerEntry[]>([]);
  const [preview, setPreview] = useState<CareGapResult | null>(null);
  const [verification, setVerification] = useState<BrowserChainVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [simulatedPreferred, setSimulatedPreferred] = useState(false);
  const ledgerRef = useRef<BrowserLedger | null>(null);

  useEffect(() => {
    checkWebGpu().then(setGpu);
    getFacilities().then((f) =>
      setFacilities(
        f.map((x) => ({ facility_id: x.facility_id, facility_name: x.facility_name, state: x.state, tribal: x.tribal })),
      ),
    );

    // Pre-compute the sample care-gap result for the preview card. Browser-side,
    // no model needed — proves the data + tool layer work before the visitor
    // commits to the 1.8 GB download.
    callEdgeTool("care_gap_finder", { facility_id: PREVIEW_FACILITY_ID })
      .then((r) => setPreview(r as CareGapResult))
      .catch(() => undefined);

    if (typeof navigator !== "undefined") {
      setNetworkOnline(navigator.onLine);
      const on = () => setNetworkOnline(true);
      const off = () => setNetworkOnline(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);

      const ledger = new BrowserLedger();
      ledgerRef.current = ledger;
      void (async () => {
        const existing = await ledger.read();
        if (existing.length === 0) {
          // Seed 4 demo entries so the panel is non-empty on first visit.
          // Real hash chain — these prove the chain works without requiring
          // model load. Notes label them as demo seed.
          await ledger.append({
            action: "system",
            phi_egress: false,
            notes: "demo seed · HealthPulse Edge boot — Gemma 4 ready in browser tab",
          });
          await ledger.append({
            action: "tool_call",
            tool_name: "care_gap_finder",
            phi_egress: false,
            notes: `demo seed · sample tool result for ${PREVIEW_FACILITY_ID}`,
          });
          await ledger.append({
            action: "tool_call",
            tool_name: "facility_benchmark",
            phi_egress: false,
            notes: `demo seed · benchmark for ${PREVIEW_FACILITY_ID} vs region 9 peers`,
          });
          await ledger.append({
            action: "chat",
            phi_egress: false,
            notes: "demo seed · executive summary streamed locally",
          });
        }
        setLedgerEntries(await ledger.read());
      })();

      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }
  }, []);

  async function refreshLedger() {
    if (ledgerRef.current) {
      setLedgerEntries(await ledgerRef.current.read());
    }
  }

  async function clearLedger() {
    if (!ledgerRef.current) return;
    await ledgerRef.current.clear();
    setLedgerEntries([]);
    setVerification(null);
  }

  async function verifyChain() {
    if (!ledgerRef.current) return;
    setVerifying(true);
    try {
      const entries = await ledgerRef.current.read();
      const result = await verifyBrowserChain(entries);
      setVerification(result);
    } finally {
      setVerifying(false);
    }
  }

  function toggleSimulated() {
    const next = !simulatedPreferred;
    setSimulatedPreferred(next);
    setSimulatedOverride(next);
    // Reset loader state so the user can re-trigger Load Gemma 4
    setLoad({ state: "idle" });
    setSummary("");
    setStreaming("");
  }

  async function load4() {
    try {
      await loadEdgeLlm(setLoad);
      if (ledgerRef.current) {
        await ledgerRef.current.append({
          action: "system",
          phi_egress: false,
          notes: isSimulatedActive() ? "Simulated narrative loaded (no WebGPU model)" : "Gemma 4 loaded in browser",
        });
      }
      await refreshLedger();
    } catch {
      // load() already pushed an error state
    }
  }

  async function runScan() {
    if (!ledgerRef.current) return;
    setBusy(true);
    setSummary("");
    setStreaming("");
    try {
      const llm = await loadEdgeLlm(setLoad);
      const gaps = await callEdgeTool("care_gap_finder", { facility_id: selected });
      await ledgerRef.current.append({
        action: "tool_call",
        tool_name: "care_gap_finder",
        result_hash: await sha256OfJson(gaps),
        phi_egress: false,
        notes: `tool result for ${selected}`,
      });

      const prompt = `${SUMMARY_PROMPT}\n${JSON.stringify(gaps).slice(0, 1500)}\n\nSummary:`;
      let final = "";
      await llm.generateResponse(prompt, (partial, done) => {
        setStreaming(partial);
        if (done) final = partial;
      });
      setSummary(final);
      await ledgerRef.current.append({
        action: "chat",
        output_hash: await sha256OfJson(final),
        phi_egress: false,
        notes: "executive summary streamed locally",
      });
      await refreshLedger();
    } finally {
      setBusy(false);
    }
  }

  const offline = !networkOnline;
  const ready = load.state === "ready";
  const usingSimulated = load.mode === "simulated" || simulatedPreferred;
  const selectedFacility = facilities.find((f) => f.facility_id === selected);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium tracking-wide ${
            offline ? "bg-emerald-600 text-white" : "bg-amber-500 text-zinc-900"
          }`}
        >
          <span aria-hidden="true">{offline ? "✓" : "●"}</span>
          <span>
            {offline
              ? "OFFLINE — model + tools running in YOUR browser, no network needed"
              : "ONLINE — load the model, then toggle DevTools network to 'offline' to verify"}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-4">
          <h1 className="text-xl font-semibold">HealthPulse Edge — Live Demo</h1>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>WebGPU: {gpu === null ? "checking…" : gpu.supported ? "available" : "unavailable"}</span>
            <button
              onClick={toggleSimulated}
              aria-pressed={simulatedPreferred}
              className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Skip the 1.8 GB download and use a deterministic narrative — proves the tool + ledger flow when bandwidth or hardware is limited"
            >
              {simulatedPreferred ? "Simulated mode: ON" : "Use simulated narrative"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        {/* Why-download explainer + load button */}
        <section
          aria-labelledby="step1-heading"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="step1-heading" className="mb-2 text-base font-semibold">
            Step 1 — Load Gemma 4 in your browser
          </h2>
          <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <div className="font-medium">Why download 1.8 GB?</div>
            <p className="mt-1 leading-relaxed">
              Once cached, Gemma 4 runs entirely in your browser tab. No server. No API key. Your
              prompt never leaves your device. Toggle DevTools to <em>offline</em> after the load and
              the model keeps responding. The download happens once per browser; cached after.
            </p>
          </div>

          {gpu && !gpu.supported && !simulatedPreferred && (
            <div
              role="alert"
              className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              <div className="font-medium">WebGPU unavailable on this browser ({gpu.reason}).</div>
              <div className="mt-1">
                Click <strong>Load Gemma 4 E2B</strong> below — we&apos;ll automatically fall back to a
                deterministic simulated narrative so you can still complete the demo path. For the
                real on-device model, use Chrome or Edge on a desktop with a discrete GPU
                {DEMO_YOUTUBE_URL ? (
                  <>
                    {" "}or{" "}
                    <a
                      href={DEMO_YOUTUBE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline"
                    >
                      watch the recorded demo on YouTube ↗
                    </a>
                  </>
                ) : (
                  <>, or see the recorded demo linked from the writeup</>
                )}
                .
              </div>
            </div>
          )}

          <button
            onClick={load4}
            disabled={load.state === "downloading" || ready}
            aria-busy={load.state === "downloading"}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {ready ? (usingSimulated ? "Simulated narrative loaded" : "Model loaded") : load.state === "downloading" ? "Loading…" : "Load Gemma 4 E2B"}
          </button>

          {load.state !== "idle" && (
            <div className="mt-4 space-y-2" role="status" aria-live="polite">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{load.message}</p>
              {load.state === "downloading" && (
                <div className="h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${load.progress ?? 0}%` }} />
                </div>
              )}
              {(load.state === "fallback_simulated" || (ready && usingSimulated)) && (
                <p className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Running in simulated mode — the tool layer + ledger are real; the narrative is a
                  deterministic stand-in. The on-device model is demonstrated in the recorded video.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Sample preview card — only shown before model loaded. Shows RAW
            metric data so the post-scan narrative is visibly the model's
            contribution, not a rephrasing of the preview text. */}
        {!ready && preview && preview.gap_count > 0 && (
          <section
            aria-labelledby="preview-heading"
            className="rounded-lg border border-sky-200 bg-sky-50 p-6 shadow-sm dark:border-sky-900 dark:bg-sky-950"
          >
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="preview-heading" className="text-base font-semibold text-sky-900 dark:text-sky-200">
                Preview — raw tool output (no model yet)
              </h2>
              <span className="rounded bg-sky-200 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-sky-900 dark:bg-sky-900 dark:text-sky-200">
                synthetic seed data
              </span>
            </div>
            <p className="mb-3 text-xs text-sky-800 dark:text-sky-300">
              The <code>care_gap_finder</code> tool ran in your browser against the bundled
              synthetic dataset (15+ Critical Access Hospitals, demonstrative — not real CMS data).
              Once you load the model and click <em>Run scan</em>, Gemma 4 will read this
              structured output and write a 2-sentence prioritization. Compare the two.
            </p>
            <ul className="space-y-1.5">
              {preview.gaps.slice(0, 3).map((g) => (
                <li
                  key={`${g.kind}-${g.measure_id}`}
                  className="rounded bg-white p-2 text-xs ring-1 ring-sky-200 dark:bg-zinc-900 dark:ring-sky-900"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-zinc-800 dark:text-zinc-100">{g.measure_id}</span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {g.score != null ? `score ${g.score}` : g.excess_ratio != null ? `excess ${g.excess_ratio.toFixed(2)}×` : ""}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-medium text-zinc-700 dark:text-zinc-200">{g.label}</div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] italic text-sky-700 dark:text-sky-300">
              Intentionally raw — what changes after model load is the prioritization sentence, not the data.
            </p>
          </section>
        )}

        {/* Step 2 — quality scan */}
        <section
          aria-labelledby="step2-heading"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="step2-heading" className="mb-3 text-base font-semibold">
            Step 2 — Run a quality scan
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label htmlFor="facility-select" className="text-xs text-zinc-600 dark:text-zinc-400">
              Facility (synthetic seed)
              <select
                id="facility-select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                aria-describedby="facility-help"
                className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {facilities.map((f) => (
                  <option key={f.facility_id} value={f.facility_id}>
                    {f.facility_id} · {f.facility_name} ({f.state}){f.tribal ? " · tribal" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={runScan}
              disabled={busy || !ready}
              aria-busy={busy}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {busy ? "Running…" : ready ? "Run care-gap scan" : "Load the model first"}
            </button>
          </div>
          <p id="facility-help" className="mt-2 text-[11px] text-zinc-500">
            All facility names + measure values are deterministic synthetic data shipped with the repo. No real PHI.
            {selectedFacility?.tribal && " · This is a tribal facility — equity-detector compares cohorts."}
          </p>

          {(streaming || summary) && (
            <div className="mt-4 rounded bg-zinc-50 p-3 text-sm leading-relaxed dark:bg-zinc-950">
              <p className="mb-1 flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <span>Gemma 4 (browser) · streaming locally</span>
                {usingSimulated && (
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                    simulated
                  </span>
                )}
              </p>
              <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{summary || streaming}</p>
            </div>
          )}
        </section>

        {/* Compliance Ledger */}
        <section
          aria-labelledby="ledger-heading"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="ledger-heading" className="text-base font-semibold">Compliance Ledger (this browser tab)</h2>
            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
              <span>{ledgerEntries.length} entries · IndexedDB-backed</span>
              <button
                onClick={verifyChain}
                disabled={verifying || ledgerEntries.length === 0}
                aria-busy={verifying}
                className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900"
                title="Re-walk the chain and recompute every hash from scratch"
              >
                {verifying ? "Verifying…" : "Verify chain integrity"}
              </button>
              {ledgerEntries.length > 0 && (
                <button
                  onClick={clearLedger}
                  className="rounded border border-zinc-300 px-1.5 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  title="Clear demo + accumulated entries from this browser tab"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {verification && (
            <div
              role="status"
              className={`mb-3 rounded border p-2 text-xs ${
                verification.valid
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              }`}
            >
              {verification.valid ? (
                <span>
                  ✓ Chain valid — {verification.checked} entries verified, every SHA-256 link recomputed from scratch.
                </span>
              ) : (
                <span>
                  ✗ Chain broken at entry #{verification.brokenAt}: {verification.reason}
                </span>
              )}
            </div>
          )}

          {ledgerEntries.length === 0 ? (
            <p className="text-xs text-zinc-500">No entries yet. Load the model and run a scan.</p>
          ) : (
            <ul className="space-y-1.5">
              {ledgerEntries.slice().reverse().slice(0, 8).map((e) => (
                <li
                  key={e.seq}
                  className="flex items-start gap-3 rounded border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <span className="font-mono text-zinc-400">#{e.seq.toString().padStart(3, "0")}</span>
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    {e.action}
                    {e.tool_name ? `:${e.tool_name}` : ""}
                  </span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    phi_egress: false
                  </span>
                  <span className="flex-1 truncate text-zinc-600 dark:text-zinc-400">{e.notes ?? ""}</span>
                  <span className="font-mono text-zinc-400" title={e.this_hash}>{e.this_hash.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="text-center text-[11px] text-zinc-500">
          Model + tools + ledger run entirely in this browser tab. Source:{" "}
          <a href="https://github.com/sgharlow/gemma-health" className="underline">
            github.com/sgharlow/gemma-health
          </a>
        </footer>
      </main>
    </div>
  );
}

async function sha256OfJson(value: unknown): Promise<string> {
  const text = JSON.stringify(value);
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
