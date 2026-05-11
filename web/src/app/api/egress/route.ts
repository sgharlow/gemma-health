import { NextResponse } from "next/server";
import { Ledger, hashJson } from "@/lib/ledger";
import { buildEgressEnvelope, type EgressInput } from "@/lib/egress";
import { join } from "node:path";

export const runtime = "nodejs";

const ledgerPath = join(process.cwd(), "..", "data", "ledger", "ledger.jsonl");

export async function POST(req: Request) {
  const body = (await req.json()) as EgressInput;
  if (!body.destination || !body.facility_id) {
    return NextResponse.json({ error: "destination + facility_id required" }, { status: 400 });
  }
  const ledger = new Ledger(ledgerPath);
  const envelope = buildEgressEnvelope(body);

  ledger.append({
    action: "egress",
    args_hash: hashJson({ destination: body.destination, period: body.reporting_period }),
    result_hash: envelope.envelope_hash,
    phi_egress: true,
    notes: `redacted ${envelope.redaction_summary.total_redactions} PHI fields; ${envelope.dp_aggregates.length} DP aggregates; ε=${envelope.privacy_budget.total_epsilon_spent}`,
  });

  return NextResponse.json({
    envelope,
    ledger: { count: ledger.count, head: ledger.headHash },
  });
}
