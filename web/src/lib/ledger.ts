import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export interface LedgerEntry {
  seq: number;
  ts: string;
  action: "chat" | "tool_call" | "egress" | "system";
  model?: string;
  tool_name?: string;
  input_hash?: string;
  output_hash?: string;
  args_hash?: string;
  result_hash?: string;
  phi_egress: boolean;
  notes?: string;
  prev_hash: string;
  this_hash: string;
}

const GENESIS_HASH = "0".repeat(64);

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashJson(value: unknown): string {
  return sha256(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value as object).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

function entryHash(entry: Omit<LedgerEntry, "this_hash">): string {
  return hashJson(entry);
}

export function makeEntry(
  seq: number,
  prev_hash: string,
  partial: Omit<LedgerEntry, "seq" | "ts" | "prev_hash" | "this_hash">,
): LedgerEntry {
  const base = { seq, ts: new Date().toISOString(), prev_hash, ...partial };
  return { ...base, this_hash: entryHash(base) };
}

export interface LedgerVerification {
  valid: boolean;
  checked: number;
  brokenAt?: number;
  reason?: string;
}

export function verifyChain(entries: LedgerEntry[]): LedgerVerification {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i) {
      return { valid: false, checked: i, brokenAt: i, reason: `seq mismatch: expected ${i}, got ${e.seq}` };
    }
    if (e.prev_hash !== prev) {
      return { valid: false, checked: i, brokenAt: i, reason: `prev_hash mismatch at seq ${i}` };
    }
    const recomputed = entryHash({
      seq: e.seq,
      ts: e.ts,
      action: e.action,
      model: e.model,
      tool_name: e.tool_name,
      input_hash: e.input_hash,
      output_hash: e.output_hash,
      args_hash: e.args_hash,
      result_hash: e.result_hash,
      phi_egress: e.phi_egress,
      notes: e.notes,
      prev_hash: e.prev_hash,
    });
    if (recomputed !== e.this_hash) {
      return { valid: false, checked: i + 1, brokenAt: i, reason: `this_hash mismatch at seq ${i}` };
    }
    prev = e.this_hash;
  }
  return { valid: true, checked: entries.length };
}

export class Ledger {
  private nextSeq = 0;
  private prev = GENESIS_HASH;
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
    if (existsSync(path)) {
      const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        const e = JSON.parse(line) as LedgerEntry;
        this.nextSeq = e.seq + 1;
        this.prev = e.this_hash;
      }
    } else {
      mkdirSync(dirname(path), { recursive: true });
    }
  }

  append(partial: Omit<LedgerEntry, "seq" | "ts" | "prev_hash" | "this_hash">): LedgerEntry {
    const entry = makeEntry(this.nextSeq, this.prev, partial);
    appendFileSync(this.path, JSON.stringify(entry) + "\n");
    this.nextSeq += 1;
    this.prev = entry.this_hash;
    return entry;
  }

  read(): LedgerEntry[] {
    if (!existsSync(this.path)) return [];
    return readFileSync(this.path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LedgerEntry);
  }

  get headHash(): string {
    return this.prev;
  }

  get count(): number {
    return this.nextSeq;
  }
}
