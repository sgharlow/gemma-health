import { NextResponse } from "next/server";
import { Ledger, hashJson } from "@/lib/ledger";
import { extractSurveyFromImage } from "@/lib/vision";
import { join } from "node:path";

export const runtime = "nodejs";

const ledgerPath = join(process.cwd(), "..", "data", "ledger", "ledger.jsonl");

export async function POST(req: Request) {
  const body = (await req.json()) as { image_b64?: string };
  if (!body.image_b64) return NextResponse.json({ error: "image_b64 required" }, { status: 400 });

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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
