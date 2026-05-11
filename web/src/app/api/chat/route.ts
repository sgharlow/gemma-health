import { NextResponse } from "next/server";
import { ollamaChat, type ChatMessage } from "@/lib/ollama";
import { Ledger, hashJson } from "@/lib/ledger";
import { listTools, callTool } from "@/lib/tools";
import { join } from "node:path";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are HealthPulse Edge, a quality intelligence assistant for a Critical Access Hospital. You run entirely on-device. You never see PHI directly — you call tools that return de-identified, aggregated data. Be concise, cite the tool you used, and never invent numbers.`;

const MAX_TOOL_HOPS = 4;

const ledgerPath = join(process.cwd(), "..", "data", "ledger", "ledger.jsonl");

export async function POST(req: Request) {
  const body = (await req.json()) as { messages: ChatMessage[] };
  const ledger = new Ledger(ledgerPath);

  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...body.messages];
  const tools = listTools();

  ledger.append({
    action: "chat",
    input_hash: hashJson(body.messages),
    phi_egress: false,
    notes: "user turn received",
  });

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

  return NextResponse.json(
    { error: `tool-call loop exceeded ${MAX_TOOL_HOPS} hops` },
    { status: 500 },
  );
}
