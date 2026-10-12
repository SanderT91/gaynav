import { describe, expect, it } from "vitest";
import { evidenceFailure } from "./failures";
import { toEvidencePackRow } from "./store";

const STAFF = "00000000-0000-0000-0000-00000000000c";

describe("toEvidencePackRow", () => {
  it("stores a successful pack with its sources, model and usage", () => {
    const row = toEvidencePackRow(
      9990000001,
      {
        ok: true,
        pack: { summary: "s", signals: [], open_questions: [] },
        sources: [{ source_id: "desc-9990000001", kind: "description", label: "d", text: "t" }],
        model: "claude-opus-5-5",
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      STAFF,
    );
    expect(row).toMatchObject({
      status: "ready",
      model: "claude-opus-5-5",
      failure_reason: null,
      generated_by: STAFF,
    });
    expect(row.pack?.summary).toBe("s");
  });

  it("stores a failure with its reason and staff message, and never a pack", () => {
    const row = toEvidencePackRow(9990000001, evidenceFailure("refused", "detail"), STAFF);
    expect(row).toMatchObject({
      status: "failed",
      failure_reason: "refused",
      pack: null,
      sources: null,
    });
    expect(row.failure_message).toMatch(/declined/);
  });

  it("never stores the technical detail of a failure", () => {
    const row = toEvidencePackRow(
      9990000001,
      evidenceFailure("rejected", "401: secret-ish detail"),
      STAFF,
    );
    expect(JSON.stringify(row)).not.toContain("secret-ish");
  });
});
