import { describe, expect, it } from "vitest";
import type { StoredEvidencePack } from "@/lib/evidence/store";
import { approvalRequirements, decisionErrorMessage } from "./decisions";

const ready = (tones: ("positive" | "neutral" | "concern")[]): StoredEvidencePack => ({
  status: "ready",
  pack: {
    summary: "s",
    signals: tones.map((tone) => ({ topic: "other", tone, statement: "x", source_ids: ["a"] })),
    open_questions: [],
  },
  sources: [],
  model: "m",
  generated_at: "2026-10-12T00:00:00Z",
});

describe("approvalRequirements (mirrors the database rules)", () => {
  it("no pack → note required", () => {
    expect(approvalRequirements(null)).toMatchObject({
      noteRequired: true,
      acknowledgementRequired: false,
    });
  });

  it("only a failed attempt → treated as no pack", () => {
    const failed: StoredEvidencePack = {
      status: "failed",
      failure_message: "x",
      generated_at: "t",
    };
    expect(approvalRequirements(failed)).toMatchObject({
      noteRequired: true,
      acknowledgementRequired: false,
    });
  });

  it("clean pack → nothing extra", () => {
    expect(approvalRequirements(ready(["positive", "neutral"]))).toMatchObject({
      noteRequired: false,
      acknowledgementRequired: false,
    });
  });

  it("pack with concerns → acknowledgement and note, and says how many", () => {
    const r = approvalRequirements(ready(["positive", "concern", "concern"]));
    expect(r).toMatchObject({ noteRequired: true, acknowledgementRequired: true });
    expect(r.explanation).toContain("2 concerns");
  });
});

describe("decisionErrorMessage", () => {
  it("passes through the database's own rule messages (written for staff)", () => {
    expect(
      decisionErrorMessage({
        code: "23514",
        message: "Approving without an evidence pack requires a note",
      }),
    ).toBe("Approving without an evidence pack requires a note.");
    expect(
      decisionErrorMessage({
        code: "23514",
        message: "Suspending or reactivating requires a reason",
      }),
    ).toBe("Suspending or reactivating requires a reason.");
  });

  it("hides any other check failure's raw text", () => {
    expect(
      decisionErrorMessage({
        code: "23514",
        message: "approved_by must reference a user with the staff role",
      }),
    ).toBe("The decision couldn't be saved. Try again.");
  });

  it.each([
    ["23505", /already on the whitelist/],
    ["42501", /not allowed/],
    ["XX000", /couldn't be saved/],
  ])("maps %s to a plain message", (code, pattern) => {
    expect(decisionErrorMessage({ code, message: "raw db text" })).toMatch(pattern);
  });
});
