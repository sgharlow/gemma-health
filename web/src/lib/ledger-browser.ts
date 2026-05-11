/**
 * IndexedDB-backed compliance ledger for the browser.
 *
 * Same SHA-256 hash chain as the server Ledger, just backed by IndexedDB
 * instead of JSONL on disk. Hash uses crypto.subtle (browser API).
 */

const DB_NAME = "healthpulse-edge-ledger";
const STORE = "entries";
const GENESIS = "0".repeat(64);

export interface BrowserLedgerEntry {
  seq: number;
  ts: string;
  action: "chat" | "tool_call" | "egress" | "system";
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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function entryHash(entry: Omit<BrowserLedgerEntry, "this_hash">): Promise<string> {
  return sha256(stableStringify(entry));
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "seq" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class BrowserLedger {
  private nextSeq = 0;
  private prev = GENESIS;
  private ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.openCursor(null, "prev");
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const last = cursor.value as BrowserLedgerEntry;
          this.nextSeq = last.seq + 1;
          this.prev = last.this_hash;
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async append(
    partial: Omit<BrowserLedgerEntry, "seq" | "ts" | "prev_hash" | "this_hash">,
  ): Promise<BrowserLedgerEntry> {
    await this.ready;
    const base = {
      seq: this.nextSeq,
      ts: new Date().toISOString(),
      prev_hash: this.prev,
      ...partial,
    };
    const this_hash = await entryHash(base);
    const entry: BrowserLedgerEntry = { ...base, this_hash };

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    this.nextSeq += 1;
    this.prev = this_hash;
    return entry;
  }

  async read(): Promise<BrowserLedgerEntry[]> {
    await this.ready;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as BrowserLedgerEntry[]).sort((a, b) => a.seq - b.seq));
      req.onerror = () => reject(req.error);
    });
  }

  async clear(): Promise<void> {
    await this.ready;
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => {
        this.nextSeq = 0;
        this.prev = GENESIS;
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  get count(): number {
    return this.nextSeq;
  }
  get headHash(): string {
    return this.prev;
  }
}

export interface BrowserChainVerification {
  valid: boolean;
  checked: number;
  brokenAt?: number;
  reason?: string;
}

export async function verifyBrowserChain(entries: BrowserLedgerEntry[]): Promise<BrowserChainVerification> {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i) return { valid: false, checked: i, brokenAt: i, reason: `seq mismatch at ${i}` };
    if (e.prev_hash !== prev) return { valid: false, checked: i, brokenAt: i, reason: `prev_hash mismatch at ${i}` };
    const recomputed = await entryHash({
      seq: e.seq,
      ts: e.ts,
      action: e.action,
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
      return { valid: false, checked: i + 1, brokenAt: i, reason: `this_hash mismatch at ${i}` };
    }
    prev = e.this_hash;
  }
  return { valid: true, checked: entries.length };
}
