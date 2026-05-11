/**
 * Browser-side Gemma 4 runtime via MediaPipe LLM Inference.
 *
 * Lazy-loaded so the main bundle is not bloated for users who never visit /edge.
 * Caches the loaded instance as long as the page stays open.
 */

const DEFAULT_MODEL_URL =
  process.env.NEXT_PUBLIC_GEMMA_EDGE_MODEL_URL ??
  // Verified-on-Mac default. Update once MediaPipe-packaged Gemma 4 .task URL is final.
  "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.task";

const SIMULATED = process.env.NEXT_PUBLIC_EDGE_SIMULATED === "true";

interface LlmInferenceLike {
  generateResponse(prompt: string, listener?: (partial: string, done: boolean) => void): Promise<string>;
}

let cached: LlmInferenceLike | null = null;

export interface LoadProgress {
  state: "idle" | "checking" | "downloading" | "ready" | "error";
  progress?: number;
  message?: string;
}

export async function checkWebGpu(): Promise<{ supported: boolean; reason?: string }> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return { supported: false, reason: "navigator.gpu missing — use Chrome or Edge with WebGPU enabled" };
  }
  try {
    const adapter = await (navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter();
    if (!adapter) return { supported: false, reason: "GPU adapter returned null" };
    return { supported: true };
  } catch (e) {
    return { supported: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

async function simulateLoad(onProgress: (p: LoadProgress) => void): Promise<LlmInferenceLike> {
  for (let p = 0; p <= 100; p += 5) {
    await new Promise((r) => setTimeout(r, 50));
    onProgress({ state: "downloading", progress: p, message: `Simulated download ${p}%` });
  }
  return {
    async generateResponse(prompt: string, listener) {
      const fake = `[SIMULATED] You asked: "${prompt.slice(0, 80)}". Set NEXT_PUBLIC_EDGE_SIMULATED=false on the Mac with WebGPU to use real Gemma 4 E2B.`;
      if (listener) {
        for (let i = 0; i < fake.length; i += 8) {
          listener(fake.slice(0, i + 8), false);
          await new Promise((r) => setTimeout(r, 20));
        }
        listener(fake, true);
      }
      return fake;
    },
  };
}

export async function loadEdgeLlm(onProgress: (p: LoadProgress) => void = () => undefined): Promise<LlmInferenceLike> {
  if (cached) return cached;

  if (SIMULATED) {
    onProgress({ state: "checking", message: "Simulated mode — skipping WebGPU check" });
    cached = await simulateLoad(onProgress);
    onProgress({ state: "ready", message: "Simulated model ready" });
    return cached;
  }

  onProgress({ state: "checking", message: "Checking WebGPU…" });
  const gpu = await checkWebGpu();
  if (!gpu.supported) {
    onProgress({ state: "error", message: gpu.reason ?? "WebGPU unavailable" });
    throw new Error(gpu.reason ?? "WebGPU unavailable");
  }

  onProgress({ state: "downloading", progress: 0, message: "Downloading Gemma 4 E2B…" });

  const { FilesetResolver, LlmInference } = await import("@mediapipe/tasks-genai");
  const fileset = await FilesetResolver.forGenAiTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm",
  );

  // The MediaPipe API does not currently expose a granular byte-progress hook
  // for createFromOptions, so we fake a smooth indicator while it loads.
  let progress = 5;
  const tick = setInterval(() => {
    progress = Math.min(progress + 2, 95);
    onProgress({
      state: "downloading",
      progress,
      message: `Loading Gemma 4 E2B from ${new URL(DEFAULT_MODEL_URL).host}…`,
    });
  }, 500);

  try {
    const llm = await LlmInference.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: DEFAULT_MODEL_URL },
      maxTokens: 512,
      topK: 40,
      temperature: 0.2,
      randomSeed: 42,
    });
    clearInterval(tick);
    onProgress({ state: "ready", progress: 100, message: "Model ready — running entirely in this browser" });
    cached = {
      async generateResponse(prompt, listener) {
        if (listener) {
          let acc = "";
          await llm.generateResponse(prompt, (partial: string, done: boolean) => {
            acc += partial;
            listener(acc, done);
          });
          return acc;
        }
        return await llm.generateResponse(prompt);
      },
    };
    return cached;
  } catch (e) {
    clearInterval(tick);
    const msg = e instanceof Error ? e.message : String(e);
    onProgress({ state: "error", message: msg });
    throw e;
  }
}
