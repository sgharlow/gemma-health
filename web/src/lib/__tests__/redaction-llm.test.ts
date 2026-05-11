import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { deepRedactText, deepRedactObject } from "../redaction-llm";

beforeAll(() => {
  process.env.STUB_LLM_REDACTION = "true";
});

afterEach(() => {
  process.env.STUB_LLM_REDACTION = "true";
});

describe("deepRedactText (with stubbed LLM)", () => {
  it("applies regex layer + stubbed LLM spans", async () => {
    const r = await deepRedactText("Yazzie reported pain. Phone (555) 123-4567 ok. Begay better.");
    expect(r.redacted).not.toMatch(/Yazzie/);
    expect(r.redacted).not.toMatch(/Begay/);
    expect(r.redacted).not.toMatch(/123-4567/);
    expect(r.llm_spans_found).toBeGreaterThan(0);
    expect(r.total_redactions).toBeGreaterThanOrEqual(3);
  });

  it("regex hits still count even when LLM finds nothing extra", async () => {
    const r = await deepRedactText("SSN 123-45-6789, no other identifiers here.");
    expect(r.field_counts.ssn).toBe(1);
    expect(r.total_redactions).toBeGreaterThanOrEqual(1);
  });
});

describe("deepRedactObject (with stubbed LLM)", () => {
  it("walks nested fields and applies both regex + LLM", async () => {
    const r = await deepRedactObject({
      record: { note: "Yazzie called from (555) 123-4567" },
      meta: { facility: "DEMO-CAH-001" },
    });
    const dump = JSON.stringify(r.redacted);
    expect(dump).not.toMatch(/Yazzie/);
    expect(dump).not.toMatch(/123-4567/);
    expect(dump).toMatch(/DEMO-CAH-001/); // not PHI
    expect(r.llm_spans_found).toBeGreaterThan(0);
  });
});
