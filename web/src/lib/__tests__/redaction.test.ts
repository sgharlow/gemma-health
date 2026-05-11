import { describe, expect, it } from "vitest";
import { redactPhi, redactObject } from "../redaction";

describe("redactPhi", () => {
  it("strips SSN with dashes", () => {
    const r = redactPhi("Patient SSN 123-45-6789 admitted today.");
    expect(r.redacted).not.toMatch(/123-45-6789/);
    expect(r.field_counts.ssn).toBe(1);
  });

  it("strips phone numbers in multiple formats", () => {
    const r = redactPhi("Call (555) 123-4567 or 555.123.4567 or +1-555-123-4567.");
    expect(r.field_counts.phone).toBeGreaterThanOrEqual(3);
  });

  it("strips email addresses", () => {
    const r = redactPhi("Contact patient at jdoe@example.com for follow-up.");
    expect(r.redacted).not.toMatch(/jdoe@example\.com/);
    expect(r.field_counts.email).toBe(1);
  });

  it("strips MRN labels", () => {
    const r = redactPhi("MRN: 12345-XYZ and MR# A-987 noted.");
    expect(r.field_counts.mrn).toBeGreaterThanOrEqual(2);
  });

  it("strips DOB with label and loose dates", () => {
    const r = redactPhi("DOB: 03/14/1972, last visit on 04/22/2026.");
    expect(r.classes_found).toContain("dob");
    expect(r.classes_found).toContain("dob_loose");
  });

  it("strips street addresses", () => {
    const r = redactPhi("Lives at 1234 Sage Brush Avenue, Window Rock.");
    expect(r.field_counts.address).toBe(1);
  });

  it("strips honorific name patterns", () => {
    const r = redactPhi("Dr. Smith called about Mr. Yazzie.");
    expect(r.field_counts.name_title).toBeGreaterThanOrEqual(2);
  });

  it("returns 0 redactions for a clean string", () => {
    const r = redactPhi("This text is fine and contains no protected information.");
    expect(r.total_redactions).toBe(0);
    expect(r.classes_found).toEqual([]);
  });

  it("totals match per-class sum", () => {
    const r = redactPhi("SSN 123-45-6789, phone (555) 123-4567, email a@b.com.");
    const sum = Object.values(r.field_counts).reduce((a, b) => a + b, 0);
    expect(r.total_redactions).toBe(sum);
  });
});

describe("redactObject", () => {
  it("walks nested objects + arrays and tracks aggregate counts", () => {
    const input = {
      patient: { name: "Mr. Yazzie", ssn: "123-45-6789" },
      notes: ["Phone (555) 123-4567 ok", "Email at a@b.com"],
      meta: { facility: "DEMO-CAH-001" },
    };
    const r = redactObject(input);
    expect(JSON.stringify(r.redacted)).not.toMatch(/123-45-6789/);
    expect(JSON.stringify(r.redacted)).not.toMatch(/a@b\.com/);
    expect(r.total_redactions).toBeGreaterThanOrEqual(3);
    expect(r.classes_found).toEqual(expect.arrayContaining(["ssn", "phone", "email"]));
    expect((r.redacted as { meta: { facility: string } }).meta.facility).toBe("DEMO-CAH-001");
  });
});
