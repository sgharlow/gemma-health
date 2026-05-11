import { NextResponse } from "next/server";
import { Ledger, verifyChain } from "@/lib/ledger";
import { join } from "node:path";

export const runtime = "nodejs";

const ledgerPath = join(process.cwd(), "..", "data", "ledger", "ledger.jsonl");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 200);

  try {
    const ledger = new Ledger(ledgerPath);
    const all = ledger.read();
    const recent = all.slice(-limit);
    const verification = verifyChain(all);

    return NextResponse.json({
      count: ledger.count,
      head: ledger.headHash,
      verification,
      entries: recent,
      persistent: ledger.persistent,
    });
  } catch (e) {
    return NextResponse.json({
      count: 0,
      head: "0".repeat(64),
      verification: { valid: true, checked: 0 },
      entries: [],
      persistent: false,
      note:
        "Ledger persistence unavailable in this environment (read-only filesystem). The cryptographic ledger is the on-prem app's primary feature; the public preview at /edge uses an IndexedDB-backed ledger that runs entirely in your browser.",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
