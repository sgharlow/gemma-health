import { NextResponse } from "next/server";
import { Ledger, verifyChain } from "@/lib/ledger";
import { join } from "node:path";

export const runtime = "nodejs";

const ledgerPath = join(process.cwd(), "..", "data", "ledger", "ledger.jsonl");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 200);

  const ledger = new Ledger(ledgerPath);
  const all = ledger.read();
  const recent = all.slice(-limit);
  const verification = verifyChain(all);

  return NextResponse.json({
    count: ledger.count,
    head: ledger.headHash,
    verification,
    entries: recent,
  });
}
