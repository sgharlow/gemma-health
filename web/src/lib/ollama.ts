/**
 * Minimal Ollama adapter with a model fallback chain.
 *
 * The submission targets Gemma 4 (the contest's eponymous model family) but
 * Ollama tag naming for Gemma 4 may not be exactly `gemma4:e4b` on every box
 * at every point in time. Rather than crash on a missing tag, we walk a
 * documented fallback chain so the Mac sweep is robust to tag-naming drift.
 *
 * Resolution is cached per role per process; the first successful match wins
 * and subsequent calls skip the `/api/tags` lookup.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const GEMMA_MODEL = process.env.GEMMA_MODEL ?? "gemma4:e4b";
const GEMMA_REDACTION_MODEL = process.env.GEMMA_REDACTION_MODEL ?? "gemma4:e2b";

const PRIMARY_FALLBACK_CHAIN = ["gemma4:e4b", "gemma4", "gemma4:latest", "gemma3:4b", "gemma3"];
const REDACTION_FALLBACK_CHAIN = ["gemma4:e2b", "gemma4:2b", "gemma3:1b", "gemma3"];

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string; images?: string[] }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; name: string; content: string };

export interface ToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OllamaChatResponse {
  message: {
    role: "assistant";
    content: string;
    tool_calls?: ToolCall[];
  };
  done: boolean;
}

interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  model?: string;
  signal?: AbortSignal;
}

export async function ollamaChat(opts: ChatOptions): Promise<OllamaChatResponse> {
  const model = opts.model ?? (await resolveGemmaModel("primary"));
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      tools: opts.tools,
      stream: false,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status} (model=${model}): ${await res.text()}`);
  }
  return (await res.json()) as OllamaChatResponse;
}

export async function ollamaPing(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
  resolved_primary_model?: string;
  resolved_redaction_model?: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/version`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const j = (await res.json()) as { version: string };
    // Resolve both roles up-front so the health page shows the operator the
    // exact tags they should expect calls to land on.
    const [primary, redaction] = await Promise.all([
      resolveGemmaModel("primary").catch(() => GEMMA_MODEL),
      resolveGemmaModel("redaction").catch(() => GEMMA_REDACTION_MODEL),
    ]);
    return {
      ok: true,
      version: j.version,
      resolved_primary_model: primary,
      resolved_redaction_model: redaction,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function listInstalledModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return [];
    const j = (await res.json()) as { models?: Array<{ name: string }> };
    return j.models?.map((m) => m.name) ?? [];
  } catch {
    return [];
  }
}

let cachedPrimary: string | null = null;
let cachedRedaction: string | null = null;

export async function resolveGemmaModel(role: "primary" | "redaction"): Promise<string> {
  if (role === "primary" && cachedPrimary) return cachedPrimary;
  if (role === "redaction" && cachedRedaction) return cachedRedaction;

  const head = role === "primary" ? GEMMA_MODEL : GEMMA_REDACTION_MODEL;
  const chain =
    role === "primary"
      ? [head, ...PRIMARY_FALLBACK_CHAIN]
      : [head, ...REDACTION_FALLBACK_CHAIN];
  // De-dupe while preserving order
  const seen = new Set<string>();
  const ordered = chain.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));

  const installed = await listInstalledModels();
  let pick: string | null = null;
  for (const tag of ordered) {
    if (installed.includes(tag)) {
      pick = tag;
      break;
    }
    const partial = installed.find((m) => m === tag || m.startsWith(tag + "-") || m.startsWith(tag + "."));
    if (partial) {
      pick = partial;
      break;
    }
  }
  // If nothing installed, return the head — the actual chat call will surface
  // a clean Ollama error naming the missing tag rather than silently
  // succeeding with the wrong model.
  const resolved = pick ?? head;
  if (role === "primary") cachedPrimary = resolved;
  else cachedRedaction = resolved;
  return resolved;
}

export function clearModelResolutionCacheForTesting(): void {
  cachedPrimary = null;
  cachedRedaction = null;
}

export const config = {
  OLLAMA_HOST,
  GEMMA_MODEL,
  GEMMA_REDACTION_MODEL,
  PRIMARY_FALLBACK_CHAIN,
  REDACTION_FALLBACK_CHAIN,
};
