"use client";

import { useEffect, useRef, useState } from "react";

interface SurveyExtraction {
  patient_initials?: string;
  visit_date?: string;
  rating_overall?: number;
  rating_communication?: number;
  rating_pain_management?: number;
  free_text_feedback?: string;
  note?: string;
}

interface VisionResponse {
  extraction?: SurveyExtraction | null;
  ledger?: { count: number; head: string };
  error?: string;
  hint?: string;
  detail?: string;
}

export default function WebcamCapture({ onCapture }: { onCapture?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VisionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function stop() {
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setStreaming(false);
  }

  async function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    const b64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, "");

    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_b64: b64 }),
      });
      const data = (await res.json()) as VisionResponse;
      setResult(data);
      onCapture?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Capture handwritten patient survey (multimodal)
        </h2>
        <div className="flex gap-2">
          {!streaming && (
            <button
              onClick={start}
              className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Start camera
            </button>
          )}
          {streaming && (
            <>
              <button
                onClick={capture}
                disabled={busy}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {busy ? "Reading…" : "Capture + extract"}
              </button>
              <button
                onClick={stop}
                className="rounded bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
              >
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <video
          ref={videoRef}
          className={`w-full rounded bg-black ${streaming ? "" : "hidden"}`}
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />
        {result?.extraction && (
          <pre className="overflow-auto rounded bg-zinc-50 p-3 text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            {JSON.stringify(result.extraction, null, 2)}
          </pre>
        )}
        {result?.error && !result.extraction && (
          <div className="rounded bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <div className="font-semibold">{result.error}</div>
            {result.hint && <div className="mt-1">{result.hint}</div>}
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">
        Webcam frame → Gemma 4 vision (locally) → structured JSON. Image never leaves this device.
      </p>
    </div>
  );
}
