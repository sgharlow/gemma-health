"use client";

import { useEffect, useState } from "react";

interface WebGpuStatus {
  supported: boolean;
  reason?: string;
  adapter?: string;
}

interface ModelStatus {
  state: "idle" | "checking" | "downloading" | "ready" | "error";
  progress?: number;
  message?: string;
}

interface Facility {
  facility_id: string;
  facility_name: string;
  state: string;
  tribal: boolean;
}

async function checkWebGpu(): Promise<WebGpuStatus> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return { supported: false, reason: "navigator.gpu not present (need a Chromium-based browser with WebGPU enabled)" };
  }
  try {
    const adapter = await (navigator as Navigator & { gpu: { requestAdapter(): Promise<GPUAdapter | null> } }).gpu.requestAdapter();
    if (!adapter) return { supported: false, reason: "GPU adapter request returned null" };
    return { supported: true, adapter: "available" };
  } catch (e) {
    return { supported: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

interface GPUAdapter {
  features?: ReadonlySet<string>;
}

export default function EdgePage() {
  const [gpu, setGpu] = useState<WebGpuStatus | null>(null);
  const [model, setModel] = useState<ModelStatus>({ state: "idle" });
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [networkOnline, setNetworkOnline] = useState(true);

  useEffect(() => {
    checkWebGpu().then(setGpu);
    fetch("/edge/facilities.json")
      .then((r) => r.json())
      .then(setFacilities)
      .catch(() => undefined);
    if (typeof navigator !== "undefined") {
      setNetworkOnline(navigator.onLine);
      const on = () => setNetworkOnline(true);
      const off = () => setNetworkOnline(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }
  }, []);

  async function loadModel() {
    setModel({ state: "checking", message: "Checking WebGPU + cache…" });
    if (!gpu?.supported) {
      setModel({ state: "error", message: gpu?.reason ?? "WebGPU unavailable" });
      return;
    }
    setModel({ state: "downloading", progress: 0, message: "Downloading Gemma 4 E2B (~1.8 GB)…" });
    for (let p = 0; p <= 100; p += 5) {
      await new Promise((r) => setTimeout(r, 60));
      setModel({ state: "downloading", progress: p, message: `Downloading Gemma 4 E2B (~1.8 GB) — ${p}%` });
    }
    setModel({
      state: "ready",
      message: "Model ready. Inference will run in your browser. (Day-5 wiring lands the real MediaPipe LLM call.)",
    });
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div
          className={`px-4 py-2 text-xs font-medium tracking-wide ${
            !networkOnline ? "bg-emerald-600 text-white" : "bg-amber-500 text-zinc-900"
          }`}
        >
          {!networkOnline
            ? "OFFLINE — model + tools running in YOUR browser, no network needed"
            : "ONLINE — toggle DevTools network to 'offline' once the model loads to verify"}
        </div>
        <div className="flex items-baseline justify-between px-6 py-4">
          <h1 className="text-xl font-semibold">HealthPulse Edge — Live Demo (WebGPU)</h1>
          <div className="text-xs text-zinc-500">
            WebGPU: {gpu === null ? "checking…" : gpu.supported ? "available" : "unavailable"}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-base font-semibold">Run Gemma 4 in your browser</h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            This page loads Gemma 4 E2B via WebGPU and runs it locally. Once the model is downloaded
            (cached on second visit), you can toggle DevTools to <em>offline</em> and watch it keep
            working. No server. No API key. Your prompt never leaves the browser tab.
          </p>

          {gpu && !gpu.supported && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              WebGPU unavailable: {gpu.reason}. Use Chrome or Edge on a desktop with a discrete GPU,
              or watch the recorded demo from the writeup.
            </div>
          )}

          <button
            onClick={loadModel}
            disabled={model.state === "downloading" || model.state === "ready" || !gpu?.supported}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {model.state === "ready" ? "Model loaded" : "Load Gemma 4 E2B"}
          </button>

          {model.state !== "idle" && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{model.message}</p>
              {model.state === "downloading" && (
                <div className="h-2 w-full overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${model.progress ?? 0}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-base font-semibold">In-browser data preview</h2>
          <p className="mb-3 text-xs text-zinc-500">
            Same synthetic CAH dataset as the on-prem app, served as a static JSON file from this
            page. {facilities.length} facilities loaded.
          </p>
          {facilities.length > 0 && (
            <table className="w-full text-xs">
              <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Facility</th>
                  <th className="px-2 py-1 text-left font-medium">State</th>
                  <th className="px-2 py-1 text-left font-medium">Tribal</th>
                </tr>
              </thead>
              <tbody>
                {facilities.slice(0, 10).map((f) => (
                  <tr key={f.facility_id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="px-2 py-1.5">{f.facility_name}</td>
                    <td className="px-2 py-1.5 text-zinc-500">{f.state}</td>
                    <td className="px-2 py-1.5 text-zinc-500">{f.tribal ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p className="text-center text-[11px] text-zinc-500">
          Day-4 scaffold. Real MediaPipe LLM inference + tool calling lands Day 5–6.
        </p>
      </main>
    </div>
  );
}
