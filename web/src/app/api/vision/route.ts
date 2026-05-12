import { NextResponse } from "next/server";
import { Ledger, hashJson } from "@/lib/ledger";
import { extractSurveyFromImage } from "@/lib/vision";
import { ollamaPing } from "@/lib/ollama";
import { join } from "node:path";

export const runtime = "nodejs";

const ledgerPath = join(process.cwd(), "..", "data", "ledger", "ledger.jsonl");

function isStubbed(): boolean {
  const v = process.env.STUB_VISION;
  return v === "true" || v === "1";
}

export async function POST(req: Request) {
  // Defensive top-level wrapper — same pattern as /api/chat.
  try {
    return await handle(req);
  } catch (e) {
    return NextResponse.json({
      extraction: null,
      error: "internal_error",
      hint:
        "Vision route crashed. If on Vercel: this needs a local Ollama runtime. Locally: set STUB_VISION=true to bypass.",
      detail: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
  }
}

async function handle(req: Request): Promise<Response> {
  let body: { image_b64?: string };
  try {
    body = (await req.json()) as { image_b64?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.image_b64) return NextResponse.json({ error: "image_b64 required" }, { status: 400 });

  // Pre-flight before touching ledger so serverless without Ollama gets a
  // clean answer.
  if (!isStubbed()) {
    const ping = await ollamaPing();
    if (!ping.ok) {
      return NextResponse.json({
        extraction: null,
        error: "ollama_unreachable",
        hint:
          "Vision needs Ollama with a Gemma 4 multimodal model. Run `ollama pull gemma4:e4b` and `brew services start ollama`. Alternatively set STUB_VISION=true for a canned response.",
        detail: ping.error,
      });
    }
  }

  const ledger = new Ledger(ledgerPath);
  const inputHash = hashJson({ image_size: body.image_b64.length });
  ledger.append({
    action: "tool_call",
    tool_name: "vision_extract_survey",
    args_hash: inputHash,
    phi_egress: false,
    notes: "vision OCR — image processed locally, never sent off device",
  });

  try {
    const result = await extractSurveyFromImage(body.image_b64);
    ledger.append({
      action: "tool_call",
      tool_name: "vision_extract_survey",
      result_hash: hashJson(result),
      phi_egress: false,
      notes: "vision result written to local store only",
    });
    return NextResponse.json({
      extraction: result,
      ledger: { count: ledger.count, head: ledger.headHash },
    });
  } catch (e) {
    return NextResponse.json({
      extraction: null,
      error: "vision_failed",
      hint: "Gemma 4 vision call failed. Check Ollama logs: `tail -F ~/.ollama/logs/server.log`.",
      detail: e instanceof Error ? e.message : String(e),
      ledger: { count: ledger.count, head: ledger.headHash },
    });
  }
}
