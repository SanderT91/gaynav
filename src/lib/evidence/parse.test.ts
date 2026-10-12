import { describe, expect, it } from "vitest";
import { parseEvidenceReply } from "./parse";

describe("parseEvidenceReply", () => {
  const valid = {
    summary: "One review reports a warm welcome.",
    signals: [
      {
        topic: "guest_experience",
        tone: "positive",
        statement: "Warm welcome.",
        source_ids: ["rev-1"],
      },
    ],
    open_questions: [],
  };

  it("accepts a reply that matches the schema", () => {
    expect(parseEvidenceReply(JSON.stringify(valid))).toEqual(valid);
  });

  it.each([
    ["JSON cut off mid-way (max_tokens)", JSON.stringify(valid).slice(0, 40)],
    ["empty text", ""],
    ["prose instead of JSON", "Here is the evidence pack: ..."],
    ["missing summary", JSON.stringify({ ...valid, summary: undefined })],
    [
      "an approval verdict instead of signals",
      JSON.stringify({ summary: "x", verdict: "approve" }),
    ],
    [
      "an unknown signal tone",
      JSON.stringify({ ...valid, signals: [{ ...valid.signals[0], tone: "approve" }] }),
    ],
  ])("returns null (never throws) for %s", (_label, text) => {
    expect(parseEvidenceReply(text)).toBeNull();
  });
});
