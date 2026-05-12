import { NextResponse } from "next/server";
import { Ledger, hashJson } from "@/lib/ledger";
import { buildEgressEnvelope, type EgressInput } from "@/lib/egress";
import { evaluateEgress } from "@/lib/sovereignty";
import { join } from "node:path";

export const runtime = "nodejs";

const ledgerPath = join(process.cwd(), "..", "data", "ledger", "ledger.jsonl");

interface EgressBody extends EgressInput {
  signature_key_id?: string;
  sovereignty_mode_enabled?: boolean;
}

export async function POST(req: Request) {
  // Defensive top-level wrapper — same pattern as /api/chat and /api/vision.
  try {
    return await handle(req);
  } catch (e) {
    return NextResponse.json({
      envelope: null,
      error: "internal_error",
      hint: "Egress route crashed.",
      detail: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
  }
}

async function handle(req: Request): Promise<Response> {
  const body = (await req.json()) as EgressBody;
  if (!body.destination || !body.facility_id) {
    return NextResponse.json({ error: "destination + facility_id required" }, { status: 400 });
  }

  const ledger = new Ledger(ledgerPath);

  const policy = evaluateEgress({
    destination: body.destination,
    signature_key_id: body.signature_key_id,
    enabled: body.sovereignty_mode_enabled !== false,
  });

  if (policy.decision !== "allow") {
    ledger.append({
      action: "egress",
      args_hash: hashJson({ destination: body.destination, signature: body.signature_key_id ?? null }),
      phi_egress: false,
      notes: `BLOCKED by Sovereignty Mode (${policy.decision}): ${policy.rationale}`,
    });
    return NextResponse.json(
      { policy, ledger: { count: ledger.count, head: ledger.headHash } },
      { status: 403 },
    );
  }

  const envelope = await buildEgressEnvelope(body);

  ledger.append({
    action: "egress",
    args_hash: hashJson({ destination: body.destination, period: body.reporting_period }),
    result_hash: envelope.envelope_hash,
    phi_egress: true,
    notes: `redacted ${envelope.redaction_summary.total_redactions} PHI fields; ${envelope.dp_aggregates.length} DP aggregates; ε=${envelope.privacy_budget.total_epsilon_spent}; sovereignty: ${policy.decision}`,
  });

  return NextResponse.json({
    envelope,
    policy,
    ledger: { count: ledger.count, head: ledger.headHash },
  });
}
