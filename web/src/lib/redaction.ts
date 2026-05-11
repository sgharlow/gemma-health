/**
 * Regex-based PHI redaction (Day 3 fallback).
 *
 * Day 4 swaps this for a Gemma E2B sub-agent that does semantic redaction.
 * The regex layer stays as a safety net even after the LLM lands — defense in depth.
 */

interface PhiPattern {
  name: string;
  re: RegExp;
  placeholder: (match: string) => string;
}

const PATTERNS: PhiPattern[] = [
  { name: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g, placeholder: () => "[REDACTED-SSN]" },
  { name: "ssn_compact", re: /\b(?<!\d)\d{9}(?!\d)\b/g, placeholder: () => "[REDACTED-SSN]" },
  { name: "phone", re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, placeholder: () => "[REDACTED-PHONE]" },
  { name: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, placeholder: () => "[REDACTED-EMAIL]" },
  { name: "mrn", re: /\b(?:MRN|mrn|MR#|Medical Record(?: Number)?)[:\s#]*([A-Za-z0-9-]+)/g, placeholder: () => "MRN: [REDACTED]" },
  { name: "npi", re: /\b(?:NPI|npi)[:\s#]*\d{10}\b/g, placeholder: () => "NPI: [REDACTED]" },
  { name: "dob", re: /\b(?:DOB|dob|Date of Birth|D\.O\.B\.?)[:\s]*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g, placeholder: () => "DOB: [REDACTED]" },
  { name: "dob_loose", re: /\b\d{1,2}[\/.-]\d{1,2}[\/.-](?:19|20)\d{2}\b/g, placeholder: () => "[REDACTED-DATE]" },
  { name: "address", re: /\b\d+\s+(?:[A-Z][a-zA-Z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?(?:,?\s+[A-Z][a-z]+)?\b/g, placeholder: () => "[REDACTED-ADDRESS]" },
  { name: "name_title", re: /\b(?:Mr|Mrs|Ms|Mx|Dr|Doctor|Patient|Pt)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g, placeholder: () => "[REDACTED-NAME]" },
];

export interface RedactionResult {
  redacted: string;
  field_counts: Record<string, number>;
  total_redactions: number;
  classes_found: string[];
}

export function redactPhi(input: string): RedactionResult {
  let out = input;
  const counts: Record<string, number> = {};
  for (const p of PATTERNS) {
    let n = 0;
    out = out.replace(p.re, (m) => {
      n += 1;
      return p.placeholder(m);
    });
    if (n > 0) counts[p.name] = n;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    redacted: out,
    field_counts: counts,
    total_redactions: total,
    classes_found: Object.keys(counts),
  };
}

export function redactObject<T extends Record<string, unknown>>(obj: T): { redacted: T; total_redactions: number; classes_found: string[] } {
  const seen = new Set<string>();
  let total = 0;
  const visit = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = redactPhi(v);
      total += r.total_redactions;
      r.classes_found.forEach((c) => seen.add(c));
      return r.redacted;
    }
    if (Array.isArray(v)) return v.map(visit);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = visit(val);
      return out;
    }
    return v;
  };
  const redacted = visit(obj) as T;
  return { redacted, total_redactions: total, classes_found: Array.from(seen) };
}
