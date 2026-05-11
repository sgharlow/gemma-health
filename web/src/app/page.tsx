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
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? `Error: ${data.error ?? "unknown"}` },
      ]);
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
          className={`px-4 py-2 text-xs font-medium tracking-wide ${
            offline ? "bg-emerald-600 text-white" : "bg-amber-500 text-zinc-900"
          }`}
        >
          {offline
            ? "OFFLINE — Gemma 4 running locally · No data leaves this device"
            : "ONLINE — toggle airplane mode to verify on-device inference"}
          {health?.model ? ` · model: ${health.model}` : ""}
        </div>
        <div className="flex items-baseline justify-between px-6 py-4">
          <h1 className="text-xl font-semibold">HealthPulse Edge</h1>
          <div className="text-xs text-zinc-500">
            {health?.ollama.ok
              ? `Ollama ${health.ollama.version ?? ""} · ${health.host}`
              : `Ollama not reachable${health?.ollama.error ? `: ${health.ollama.error}` : ""}`}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ask the quality officer</h2>
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-xs text-zinc-500 dark:border-zinc-700">
              <p className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">Try:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>For DEMO-CAH-004, find the top 3 care gaps and tell me which one to tackle first.</li>
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
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your hospital's quality metrics…"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Send
            </button>
          </form>
        </section>

        <WebcamCapture onCapture={() => setLedgerTick((t) => t + 1)} />

        <EgressButton onSubmit={() => setLedgerTick((t) => t + 1)} />

        <LedgerView refreshSignal={ledgerTick} />
      </main>
    </div>
  );
}
