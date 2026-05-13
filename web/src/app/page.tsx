"use client";

import { useEffect, useState } from "react";
import WebcamCapture from "@/components/WebcamCapture";
import LedgerView from "@/components/LedgerView";
import EgressButton from "@/components/EgressButton";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface HealthResponse {
  ollama: { ok: boolean; version?: string; error?: string };
  model: string;
  host: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ledgerTick, setLedgerTick] = useState(0);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [sovereigntyEnabled, setSovereigntyEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
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

  async function send() {
    if (!input.trim() || busy) return;
    const userMsg: Msg = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = await res.json();
      const reply =
        data.reply ??
        [data.error && `(${data.error})`, data.hint, data.detail && `details: ${data.detail}`]
          .filter(Boolean)
          .join("\n\n");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      setLedgerTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  const offline = !networkOnline;

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
              ? "OFFLINE — Gemma 4 running locally · No data leaves this device"
              : "ONLINE — toggle airplane mode to verify on-device inference"}
            {health?.model ? ` · model: ${health.model}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-4">
          <h1 className="text-xl font-semibold">HealthPulse Edge</h1>
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sovereigntyEnabled}
                onChange={(e) => setSovereigntyEnabled(e.target.checked)}
                aria-label="Toggle Sovereignty Mode policy enforcement"
                className="h-4 w-4 rounded border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="font-medium">
                Sovereignty Mode {sovereigntyEnabled ? "ON" : "OFF"}
              </span>
            </label>
            <div className="text-xs text-zinc-500">
              {health?.ollama.ok
                ? `Ollama ${health.ollama.version ?? ""} · ${health.host}`
                : `Ollama not reachable${health?.ollama.error ? `: ${health.ollama.error}` : ""}`}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        {health && !health.ollama.ok && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-900 dark:bg-sky-950">
            <p className="font-semibold text-sky-900 dark:text-sky-200">
              This is the on-prem app — Ollama is not reachable here.
            </p>
            <p className="mt-1 text-xs text-sky-800 dark:text-sky-300">
              For the in-browser live demo (Gemma 4 running in WebGPU, no server needed), open{" "}
              <a href="/edge" className="underline font-medium">
                /edge
              </a>
              . To run the full on-prem app, follow{" "}
              <a
                href="https://github.com/sgharlow/gemma-health#path-a--full-on-prem-app-mac--linux-with-ollama"
                className="underline font-medium"
              >
                Path A
              </a>{" "}
              in the README.
            </p>
          </div>
        )}
        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Ask the quality officer
            </h2>
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sky-800 dark:bg-sky-950 dark:text-sky-300">
              synthetic seed data
            </span>
          </div>
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-xs text-zinc-500 dark:border-zinc-700">
              <p className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">Try:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>For DEMO-CAH-001, find the top 3 care gaps and tell me which one to tackle first.</li>
                <li>Compare HCAHPS scores between tribal and non-tribal CAHs.</li>
                <li>Which states have the worst CAH heart-failure mortality?</li>
              </ul>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-4 py-3 ${
                m.role === "user"
                  ? "ml-12 bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                  : "mr-12 bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
            </div>
          ))}
          {busy && (
            <div className="mr-12 rounded-lg bg-white px-4 py-3 text-sm text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              Thinking…
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <label htmlFor="chat-input" className="sr-only">
              Quality officer question
            </label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your hospital's quality metrics…"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-busy={busy}
              className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Send
            </button>
          </form>
        </section>

        <WebcamCapture onCapture={() => setLedgerTick((t) => t + 1)} />

        <EgressButton sovereigntyEnabled={sovereigntyEnabled} onSubmit={() => setLedgerTick((t) => t + 1)} />

        <LedgerView refreshSignal={ledgerTick} />

        <footer className="pt-4 text-center text-[11px] text-zinc-500">
          HealthPulse Edge · runs entirely on this machine ·{" "}
          <a href="https://github.com/sgharlow/gemma-health" className="underline">
            github.com/sgharlow/gemma-health
          </a>{" "}
          · synthetic CAH data
        </footer>
      </main>
    </div>
  );
}
