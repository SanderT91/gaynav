import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { mockEvidenceSources, mockHotelContent } from "@/mock/ratehawk";
import type { CallClaude, ClaudeEvidenceReply } from "./claude";
import { generateEvidencePack } from "./generate";
import type { EvidencePack } from "./schema";

// Every way the Claude call can go wrong must end in an explicit failure with
// a message for staff — never a blank, partial or unverified summary.

const TULIP = 9990000003;
const hotel = mockHotelContent.find((h) => h.hid === TULIP)!;
const external = mockEvidenceSources[String(TULIP)];

const goodPack: EvidencePack = {
  summary: "House rules restrict shared double rooms to married couples.",
  signals: [
    {
      topic: "house_rules",
      tone: "concern",
      statement: "Only married couples may share a double room.",
      source_ids: [`rules-${TULIP}`],
    },
  ],
  open_questions: [],
};

const replying =
  (reply: Partial<ClaudeEvidenceReply>): CallClaude =>
  async () => ({
    stop_reason: "end_turn",
    parsed: goodPack,
    model: "claude-opus-5-5",
    usage: { input_tokens: 1, output_tokens: 1 },
    ...reply,
  });

const throwing =
  (error: unknown): CallClaude =>
  async () => {
    throw error;
  };

const apiError = (status: number, type: string) =>
  Anthropic.APIError.generate(
    status,
    { type: "error", error: { type, message: type } },
    type,
    new Headers(),
  );

describe("replies that must not become a summary", () => {
  it.each([
    ["refused", { stop_reason: "refusal" }, false],
    ["truncated", { stop_reason: "max_tokens", parsed: null }, true],
    ["unparseable", { parsed: null }, true],
    ["unparseable", { stop_reason: "pause_turn" }, true],
    ["incomplete", { parsed: { ...goodPack, summary: "   " } }, true],
    [
      "incomplete",
      { parsed: { ...goodPack, signals: [{ ...goodPack.signals[0], statement: "" }] } },
      true,
    ],
    [
      "invalid_citations",
      { parsed: { ...goodPack, signals: [{ ...goodPack.signals[0], source_ids: ["made-up"] }] } },
      true,
    ],
  ] as const)("→ %s", async (reason, reply, retryable) => {
    const result = await generateEvidencePack(
      hotel,
      external,
      replying(reply as Partial<ClaudeEvidenceReply>),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(reason);
      expect(result.retryable).toBe(retryable);
      expect(result.message.length).toBeGreaterThan(20);
      expect(result).not.toHaveProperty("pack");
    }
  });
});

describe("API errors", () => {
  it.each([
    ["not_configured", new Error("ANTHROPIC_API_KEY is not set. Add it…"), false],
    ["rate_limited", apiError(429, "rate_limit_error"), true],
    ["unavailable", apiError(500, "api_error"), true],
    ["unavailable", apiError(529, "overloaded_error"), true],
    ["unavailable", new Anthropic.APIConnectionError({ message: "ECONNRESET" }), true],
    ["unavailable", new Anthropic.APIConnectionTimeoutError({ message: "timed out" }), true],
    ["rejected", apiError(401, "authentication_error"), false],
    ["rejected", apiError(400, "invalid_request_error"), false],
    ["rejected", apiError(402, "billing_error"), false],
    ["unavailable", new Error("something unexpected"), true],
  ] as const)("→ %s", async (reason, error, retryable) => {
    const result = await generateEvidencePack(hotel, external, throwing(error));
    expect(result).toMatchObject({ ok: false, reason, retryable });
  });

  it("never puts technical detail or secrets into the staff-facing message", async () => {
    const result = await generateEvidencePack(
      hotel,
      external,
      throwing(apiError(401, "authentication_error")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toMatch(/401|authentication_error|sk-ant/);
      expect(result.detail).toContain("401");
    }
  });
});

describe("a good reply", () => {
  it("is accepted only when it ended normally, parsed, and every citation checks out", async () => {
    const result = await generateEvidencePack(hotel, external, replying({}));
    expect(result.ok).toBe(true);
  });
});
