import { NextResponse } from "next/server";
import { ollamaPing, config } from "@/lib/ollama";
import { Ledger } from "@/lib/ledger";
import { loadPolicy } from "@/lib/sovereignty";
import { join } from "node:path";

export const runtime = "nodejs";

const ledgerPath = join(process.cwd(), "..", "data", "ledger", "ledger.jsonl");

export async function GET() {
  const ping = await ollamaPing();

  // Cheap reads — the ledger constructor degrades to in-memory on read-only
  // filesystems (Vercel), and the policy is a TS const so it's never absent.
  let ledgerInfo: {
    count: number;
    head_hash: string;
    persistent: boolean;
    lifetime_epsilon_spent: number;
  };
  try {
    const ledger = new Ledger(ledgerPath);
    ledgerInfo = {
      count: ledger.count,
      head_hash: ledger.headHash,
      persistent: ledger.persistent,
      lifetime_epsilon_spent: ledger.totalEpsilonSpent(),
    };
  } catch (e) {
    ledgerInfo = {
      count: 0,
      head_hash: "unavailable",
      persistent: false,
      lifetime_epsilon_spent: 0,
    };
    void e;
  }

  const policy = loadPolicy();

  return NextResponse.json({
    ollama: ping,
    model: config.GEMMA_MODEL,
    host: config.OLLAMA_HOST,
    ledger: ledgerInfo,
    sovereignty: {
      version: policy.version,
      jurisdiction: policy.jurisdiction,
      default_egress_posture: policy.default_egress_posture,
      framework_basis: policy.framework_basis,
    },
  });
}
