import { NextResponse } from "next/server";
import { ollamaPing, config } from "@/lib/ollama";

export const runtime = "nodejs";

export async function GET() {
  const ping = await ollamaPing();
  return NextResponse.json({
    ollama: ping,
    model: config.GEMMA_MODEL,
    host: config.OLLAMA_HOST,
  });
}
