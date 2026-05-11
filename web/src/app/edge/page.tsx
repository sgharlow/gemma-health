"use client";

import { useEffect, useRef, useState } from "react";
import { loadEdgeLlm, checkWebGpu, type LoadProgress } from "@/lib/edge-llm";
import { callEdgeTool } from "@/lib/tools-edge";
import { BrowserLedger, type BrowserLedgerEntry } from "@/lib/ledger-browser";
import { getFacilities } from "@/lib/edge-data";

interface Facility {
  facility_id: string;
  facility_name: string;
  state: string;
  tribal: boolean;
}

const SUMMARY_PROMPT = `You are HealthPulse Edge running in a browser tab. You receive a JSON summary of one CAH's care-gap analysis and write a 2-sentence executive summary for the quality coordinator. Cite the highest-leverage gap and the recommended intervention. Be concise. No PHI.

Input:`;

export default function EdgePage() {
  const [networkOnline, setNetworkOnline] = useState(true);
  const [gpu, setGpu] = useState<{ supported: boolean; reason?: string } | null>(null);
  const [load, setLoad] = useState<LoadProgress>({ state: "idle" });
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selected, setSelected] = useState<string>("DEMO-CAH-004");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [streaming, setStreaming] = useState<string>("");
  const [ledgerEntries, setLedgerEntries] = useState<BrowserLedgerEntry[]>([]);
  const ledgerRef = useRef<BrowserLedger | null>(null);

  useEffect(() => {
    checkWebGpu().then(setGpu);
    getFacilities().then((f) =>
      setFacilities(
        f.map((x) => ({ facility_id: x.facility_id, facility_name: x.facility_name, state: x.state, tribal: x.tribal })),
      ),
    );
    if (typeof navigator !== "undefined") {
      setNetworkOnline(navigator.onLine);
      const on = () => setNetworkOnline(true);
      const off = () => setNetworkOnline(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      ledgerRef.current = new BrowserLedger();
      ledgerRef.current.read().then(setLedgerEntries);
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

  async function load4() {
    try {
      await loadEdgeLlm(setLoad);
      if (ledgerRef.current) {
        await ledgerRef.current.append({ action: "system", phi_egress: false, notes: "Gemma 4 loaded in browser" });
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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div
          className={`px-4 py-2 text-xs font-medium tracking-wide ${
            offline ? "bg-emerald-600 text-white" : "bg-amber-500 text-zinc-900"
          }`}
        >
          {offline
            ? "OFFLINE — model + tools running in YOUR browser, no network needed"
            : "ONLINE — load the model, then toggle DevTools network to 'offline' to verify"}
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-4">
          <h1 className="text-xl font-semibold">HealthPulse Edge — Live Demo</h1>
          <div className="text-xs text-zinc-500">
            WebGPU: {gpu === null ? "checking…" : gpu.supported ? "available" : "unavailable"}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-base font-semibold">Step 1 — Load Gemma 4 in your browser</h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            ~1.8 GB on first visit, cached after. Once loaded, switch DevTools to <em>offline</em> and
            keep using this page — the model stays alive in your tab.
          </p>

          {gpu && !gpu.supported && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              WebGPU unavailable: {gpu.reason}. Use Chrome or Edge on a desktop with a discrete GPU,
              or watch the recorded demo from the writeup.
            </div>
          )}

          <button
            onClick={load4}
            disabled={load.state === "downloading" || ready || !gpu?.supported}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {ready ? "Model loaded" : load.state === "downloading" ? "Loading…" : "Load Gemma 4 E2B"}
          </button>

          {load.state !== "idle" && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{load.message}</p>
              {load.state === "downloading" && (
                <div className="h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${load.progress ?? 0}%` }} />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-base font-semibold">Step 2 — Run a quality scan</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-zinc-600 dark:text-zinc-400">
              Facility
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
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
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy ? "Running…" : ready ? "Run care-gap scan" : "Load the model first"}
            </button>
          </div>

          {(streaming || summary) && (
            <div className="mt-4 rounded bg-zinc-50 p-3 text-sm leading-relaxed dark:bg-zinc-950">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Gemma 4 (browser) · streaming locally
              </p>
              <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{summary || streaming}</p>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Compliance Ledger (this browser tab)</h2>
            <span className="text-[11px] text-zinc-500">{ledgerEntries.length} entries · IndexedDB-backed</span>
          </div>
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
                  <span className="font-mono text-zinc-400">{e.this_hash.slice(0, 10)}</span>
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
