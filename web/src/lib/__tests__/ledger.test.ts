import { afterEach, describe, expect, it } from "vitest";
import { rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ledger, hashJson, sha256, verifyChain, type LedgerEntry } from "../ledger";

let tmpDir: string;

function newLedger(): { ledger: Ledger; path: string } {
  tmpDir = mkdtempSync(join(tmpdir(), "ledger-"));
  const path = join(tmpDir, "ledger.jsonl");
  return { ledger: new Ledger(path), path };
}

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("sha256 / hashJson", () => {
  it("hashes deterministically regardless of key order", () => {
    expect(hashJson({ a: 1, b: 2 })).toBe(hashJson({ b: 2, a: 1 }));
  });
  it("differs for different content", () => {
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});

describe("Ledger.append", () => {
  it("starts at seq 0 with prev_hash = genesis", () => {
    const { ledger } = newLedger();
    const e = ledger.append({ action: "system", phi_egress: false, notes: "boot" });
    expect(e.seq).toBe(0);
    expect(e.prev_hash).toMatch(/^0+$/);
    expect(e.this_hash).toHaveLength(64);
  });

  it("chains entries by prev_hash", () => {
    const { ledger } = newLedger();
    const a = ledger.append({ action: "system", phi_egress: false });
    const b = ledger.append({ action: "chat", phi_egress: false });
    expect(b.prev_hash).toBe(a.this_hash);
    expect(b.seq).toBe(1);
  });

  it("persists across instances", () => {
    const { ledger, path } = newLedger();
    ledger.append({ action: "system", phi_egress: false });
    ledger.append({ action: "chat", phi_egress: false });
    const reopened = new Ledger(path);
    expect(reopened.count).toBe(2);
    expect(reopened.headHash).toBe(ledger.headHash);
    const next = reopened.append({ action: "tool_call", phi_egress: false });
    expect(next.seq).toBe(2);
  });
});

describe("verifyChain", () => {
  it("returns valid for a clean chain", () => {
    const { ledger } = newLedger();
    ledger.append({ action: "chat", phi_egress: false });
    ledger.append({ action: "tool_call", tool_name: "facility_benchmark", phi_egress: false });
    ledger.append({ action: "egress", phi_egress: false, notes: "redacted aggregate" });
    const result = verifyChain(ledger.read());
    expect(result.valid).toBe(true);
    expect(result.checked).toBe(3);
  });

  it("detects tampering with an entry", () => {
    const { ledger } = newLedger();
    ledger.append({ action: "chat", phi_egress: false });
    ledger.append({ action: "egress", phi_egress: false, notes: "original" });
    const entries = ledger.read();
    const tampered: LedgerEntry[] = [...entries];
    tampered[1] = { ...tampered[1], notes: "totally innocent edit" };
    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it("detects a missing entry in the middle", () => {
    const { ledger } = newLedger();
    ledger.append({ action: "chat", phi_egress: false });
    ledger.append({ action: "tool_call", phi_egress: false });
    ledger.append({ action: "chat", phi_egress: false });
    const entries = ledger.read();
    const missing: LedgerEntry[] = [entries[0], entries[2]];
    const result = verifyChain(missing);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });
});
