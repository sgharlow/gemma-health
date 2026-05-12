import { NextResponse } from "next/server";
import { ollamaChat, ollamaPing, type ChatMessage } from "@/lib/ollama";
import { Ledger, hashJson } from "@/lib/ledger";
import { join } from "node:path";

// Tools are imported lazily inside handle() — they pull in @duckdb/node-api
// which has a native binding (libduckdb.so) that is not present in Vercel's
// serverless runtime. Loading it eagerly here would crash the route module
// at import time on Vercel, before the Ollama pre-flight could return a
// clean error. On the on-prem Mac path the import is fine.

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are HealthPulse Edge, a quality intelligence assistant for a Critical Access Hospital. You run entirely on-device. You never see PHI directly — you call tools that return de-identified, aggregated data. Be concise, cite the tool you used, and never invent numbers.`;

const MAX_TOOL_HOPS = 4;

const ledgerPath = join(process.cwd(), "..", "data", "ledger", "ledger.jsonl");

export async function POST(req: Request) {
  // Defensive top-level wrapper. ANY uncaught error must produce a JSON
  // response, never let Next.js render its HTML error page (UI then chokes
  // parsing JSON). Includes errors during module init for the tool registry
  // (DuckDB binding) which can fail on serverless platforms.
  try {
    return await handle(req);
  } catch (e) {
    return NextResponse.json({
      reply: null,
      error: "internal_error",
      hint:
        "Chat route crashed before reaching Ollama. If you're running on Vercel: this route needs a local Ollama runtime. Visit /edge for the in-browser WebGPU demo instead. Locally: check `ollama list` and `npm install` is fresh.",
      detail: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
  }
}

async function handle(req: Request): Promise<Response> {
  let body: { messages: ChatMessage[] };
  try {
    body = (await req.json()) as { messages: ChatMessage[] };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body?.messages)) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  // Pre-flight Ollama BEFORE touching the tool registry (DuckDB import) so
  // serverless deploys without Ollama get a clean answer without paying the
  // cost of native-binding init that may fail in the runtime.
  const ping = await ollamaPing();
  if (!ping.ok) {
    return NextResponse.json({
      reply: null,
      error: "ollama_unreachable",
      hint:
        "This route needs a local Ollama instance. On macOS: `brew install ollama && brew services start ollama && ollama pull gemma4:e4b`. The hosted Vercel deployment cannot run Ollama; visit /edge for the in-browser WebGPU demo instead.",
      detail: ping.error,
    });
  }

  // Lazy-load the tool registry only after Ollama is confirmed reachable.
  // Avoids loading the DuckDB native binding on environments where it
  // cannot succeed (e.g. Vercel serverless without libduckdb.so).
  const { listTools, callTool } = await import("@/lib/tools");

  const ledger = new Ledger(ledgerPath);
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...body.messages];
  const tools = listTools();

  ledger.append({
    action: "chat",
    input_hash: hashJson(body.messages),
    phi_egress: false,
    notes: "user turn received",
  });

  try {
    for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
      const res = await ollamaChat({ messages, tools });
      const msg = res.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          const result = await callTool(tc.function.name, tc.function.arguments);
          ledger.append({
            action: "tool_call",
            tool_name: tc.function.name,
            args_hash: hashJson(tc.function.arguments),
            result_hash: hashJson(result),
            phi_egress: false,
          });
          messages.push({ role: "tool", name: tc.function.name, content: JSON.stringify(result) });
        }
        continue;
      }

      ledger.append({
        action: "chat",
        output_hash: hashJson(msg.content),
        phi_egress: false,
        notes: "assistant final turn",
      });

      return NextResponse.json({
        reply: msg.content,
        ledger: { count: ledger.count, head: ledger.headHash },
      });
    }

    return NextResponse.json({
      reply: null,
      error: "tool_loop_exceeded",
      hint: `The model fired tool calls for ${MAX_TOOL_HOPS} hops without converging on a final reply. Try a more focused prompt.`,
      ledger: { count: ledger.count, head: ledger.headHash },
    });
  } catch (e) {
    return NextResponse.json({
      reply: null,
      error: "ollama_error",
      hint: "Ollama call failed mid-loop. Check `ollama list` to confirm gemma4:e4b is pulled.",
      detail: e instanceof Error ? e.message : String(e),
      ledger: { count: ledger.count, head: ledger.headHash },
    });
  }
}
