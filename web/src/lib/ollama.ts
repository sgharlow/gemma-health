const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const GEMMA_MODEL = process.env.GEMMA_MODEL ?? "gemma4:e4b";

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
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
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? GEMMA_MODEL,
      messages: opts.messages,
      tools: opts.tools,
      stream: false,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as OllamaChatResponse;
}

export async function ollamaPing(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/version`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const j = (await res.json()) as { version: string };
    return { ok: true, version: j.version };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const config = { OLLAMA_HOST, GEMMA_MODEL };
