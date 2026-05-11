/**
 * Defense-in-depth: a small Gemma E2B sub-agent that runs AFTER the regex
 * layer to catch PHI patterns regex can't reliably detect — names without
 * honorifics, ad-hoc identifiers, indirect mentions ("the patient who came
 * in Tuesday with the broken arm"), free-text quotes that contain PII.
 *
 * Regex is the floor. The LLM is a second pass. If the LLM fails, we ship
 * what regex caught — fail-closed for privacy means we never depend on the
 * LLM to be present.
 */

import { ollamaChat, type ChatMessage } from "./ollama";
import { redactPhi, redactObject, type RedactionResult } from "./redaction";

const STUB_LLM_REDACTION =
  process.env.STUB_LLM_REDACTION === "true" || process.env.STUB_LLM_REDACTION === "1";
const REDACTION_MODEL = process.env.GEMMA_REDACTION_MODEL ?? "gemma4:e2b";

const SYSTEM = `You are a PHI redaction reviewer. The text below has already been scrubbed for SSN, phone, email, MRN, NPI, DOB, address, and named honorifics. Your job is to find PHI the regex layer missed.

Look for:
- Names without honorifics (e.g. "Yazzie reported", "Begay was discharged")
- Indirect identifiers ("the patient who came in Tuesday with the broken arm")
- Ad-hoc identifiers (room numbers, badge IDs, timestamps that pinpoint individuals)
- Quoted patient speech that contains PII

Respond with JSON only:
{ "spans": [ { "text": "<exact substring to redact>", "kind": "<name|indirect|adhoc|quote|other>", "reason": "<short>" } ] }

If nothing remaining, return { "spans": [] }.`;

interface LlmSpan {
  text: string;
  kind: string;
  reason?: string;
}

interface LlmResponse {
  spans: LlmSpan[];
}

const STUB_RESPONSE: LlmResponse = {
  spans: [
    { text: "Yazzie", kind: "name", reason: "surname without honorific" },
    { text: "Begay", kind: "name", reason: "surname without honorific" },
  ],
};

async function callRedactionLlm(text: string): Promise<LlmResponse> {
  if (STUB_LLM_REDACTION) return STUB_RESPONSE;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: text },
  ];
  try {
    const res = await ollamaChat({ messages, model: REDACTION_MODEL });
    const raw = res.message.content?.trim() ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { spans: [] };
    const parsed = JSON.parse(m[0]) as LlmResponse;
    return Array.isArray(parsed.spans) ? parsed : { spans: [] };
  } catch {
    return { spans: [] };
  }
}

export interface DeepRedactionResult extends RedactionResult {
  llm_spans_found: number;
  llm_classes_found: string[];
}

function applySpans(text: string, spans: LlmSpan[]): { redacted: string; applied: number } {
  let out = text;
  let applied = 0;
  for (const span of spans) {
    if (!span.text || span.text.length < 2) continue;
    const escaped = span.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "g");
    let count = 0;
    out = out.replace(re, () => {
      count += 1;
      return `[REDACTED-${span.kind.toUpperCase()}]`;
    });
    applied += count;
  }
  return { redacted: out, applied };
}

export async function deepRedactText(input: string): Promise<DeepRedactionResult> {
  const regexLayer = redactPhi(input);
  const llm = await callRedactionLlm(regexLayer.redacted);
  const { redacted: finalText, applied } = applySpans(regexLayer.redacted, llm.spans);
  const classes = new Set<string>(llm.spans.map((s) => `llm_${s.kind}`));
  return {
    redacted: finalText,
    field_counts: { ...regexLayer.field_counts, ...Object.fromEntries(Array.from(classes).map((c) => [c, llm.spans.filter((s) => `llm_${s.kind}` === c).length])) },
    classes_found: [...regexLayer.classes_found, ...classes],
    total_redactions: regexLayer.total_redactions + applied,
    llm_spans_found: llm.spans.length,
    llm_classes_found: Array.from(classes),
  };
}

export async function deepRedactObject<T extends Record<string, unknown>>(
  obj: T,
): Promise<{ redacted: T; total_redactions: number; classes_found: string[]; llm_spans_found: number }> {
  const regexLayer = redactObject(obj);
  let llmSpans = 0;
  const llmClasses = new Set<string>();
  const visit = async (v: unknown): Promise<unknown> => {
    if (typeof v === "string") {
      const llm = await callRedactionLlm(v);
      llmSpans += llm.spans.length;
      llm.spans.forEach((s) => llmClasses.add(`llm_${s.kind}`));
      return applySpans(v, llm.spans).redacted;
    }
    if (Array.isArray(v)) return Promise.all(v.map(visit));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = await visit(val);
      return out;
    }
    return v;
  };
  const second = (await visit(regexLayer.redacted)) as T;
  return {
    redacted: second,
    total_redactions: regexLayer.total_redactions + llmSpans,
    classes_found: [...regexLayer.classes_found, ...llmClasses],
    llm_spans_found: llmSpans,
  };
}
