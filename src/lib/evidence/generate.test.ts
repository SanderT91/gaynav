import { describe, expect, it, vi } from "vitest";
import { mockEvidenceSources, mockHotelContent } from "@/mock/ratehawk";
import type { CallClaude, ClaudeEvidenceReply } from "./claude";
import { citationProblems, generateEvidencePack } from "./generate";
import { EVIDENCE_SYSTEM_PROMPT } from "./prompt";
import type { EvidencePack } from "./schema";
import { collectSources } from "./sources";

// No real API calls here: a stand-in replaces Claude, so these tests check
// GAYNAV's own logic — what is sent, and what is accepted back.

const hotel = (hid: number) => mockHotelContent.find((h) => h.hid === hid)!;
const external = (hid: number) => mockEvidenceSources[String(hid)];
const TULIP = 9990000003; // red-flag house rule
const RAMBLA = 9990000010; // gender specification required

function fakeClaude(pack: EvidencePack): CallClaude & ReturnType<typeof vi.fn> {
  const reply: ClaudeEvidenceReply = {
    stop_reason: "end_turn",
    parsed: pack,
    model: "claude-opus-5-5",
    usage: { input_tokens: 1200, output_tokens: 300 },
  };
  return vi.fn(async () => reply);
}

describe("collectSources", () => {
  it("turns house rules and booking requirements into citable sources", () => {
    const ids = collectSources(hotel(RAMBLA), external(RAMBLA)).map((s) => s.source_id);
    expect(ids).toContain(`rules-${RAMBLA}`);
    expect(ids).toContain(`gender-${RAMBLA}`);
    expect(ids).toContain(`desc-${RAMBLA}`);
  });

  it("includes every review and press item with its own id", () => {
    const ids = collectSources(hotel(TULIP), external(TULIP)).map((s) => s.source_id);
    for (const s of external(TULIP)) expect(ids).toContain(s.source_id);
  });
});

describe("generateEvidencePack", () => {
  const validPack: EvidencePack = {
    summary:
      "House rules restrict shared double rooms to married couples; one review reports being asked about marriage.",
    signals: [
      {
        topic: "house_rules",
        tone: "concern",
        statement: "Only married couples may share a double room.",
        source_ids: [`rules-${TULIP}`],
      },
      {
        topic: "guest_experience",
        tone: "concern",
        statement: "One guest was asked about marital status before receiving a double room.",
        source_ids: [`rev-${TULIP}-01`],
      },
    ],
    open_questions: ["Does the marriage rule apply to same-sex married couples in practice?"],
  };

  it("returns a pack whose citations all point at real sources", async () => {
    const result = await generateEvidencePack(hotel(TULIP), external(TULIP), fakeClaude(validPack));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pack).toEqual(validPack);
      expect(result.model).toBe("claude-opus-5-5");
    }
  });

  it("sends the hotel's sources, with their ids, in the request", async () => {
    const claude = fakeClaude(validPack);
    await generateEvidencePack(hotel(TULIP), external(TULIP), claude);
    const sent = claude.mock.calls[0][0] as string;
    expect(sent).toContain(hotel(TULIP).name);
    expect(sent).toContain(`<source id="rules-${TULIP}"`);
    expect(sent).toContain("Only married couples may share a double room.");
  });

  it("rejects the whole pack if any citation was invented", async () => {
    const fabricated: EvidencePack = {
      ...validPack,
      signals: [
        ...validPack.signals,
        {
          topic: "press",
          tone: "concern",
          statement: "A newspaper reported a lawsuit.",
          source_ids: ["press-9990000003-07"],
        },
      ],
    };
    const result = await generateEvidencePack(
      hotel(TULIP),
      external(TULIP),
      fakeClaude(fabricated),
    );
    expect(result).toMatchObject({ ok: false, reason: "invalid_citations" });
    if (!result.ok) expect(result.detail).toContain("press-9990000003-07");
  });

  it("rejects a pack with an uncited signal", async () => {
    const uncited: EvidencePack = {
      ...validPack,
      signals: [
        {
          topic: "lgbtq_welcome",
          tone: "positive",
          statement: "The hotel is welcoming.",
          source_ids: [],
        },
      ],
    };
    const result = await generateEvidencePack(hotel(TULIP), external(TULIP), fakeClaude(uncited));
    expect(result).toMatchObject({ ok: false, reason: "invalid_citations" });
  });

  it("rejects a citation to another hotel's source", async () => {
    const crossed: EvidencePack = {
      ...validPack,
      signals: [
        {
          topic: "press",
          tone: "positive",
          statement: "Praised in a city guide.",
          source_ids: ["press-9990000001-01"],
        },
      ],
    };
    const result = await generateEvidencePack(hotel(TULIP), external(TULIP), fakeClaude(crossed));
    expect(result).toMatchObject({ ok: false, reason: "invalid_citations" });
  });

  it("does not call Claude at all when there is nothing to summarise", async () => {
    const empty = { ...hotel(TULIP), description_struct: [], metapolicy_extra_info: "" };
    const claude = fakeClaude(validPack);
    const result = await generateEvidencePack(empty, [], claude);
    expect(result).toMatchObject({ ok: false, reason: "no_sources" });
    expect(claude).not.toHaveBeenCalled();
  });
});

describe("citationProblems", () => {
  it("accepts an empty signal list (nothing relevant found is a valid answer)", () => {
    expect(
      citationProblems({ summary: "Nothing relevant.", signals: [], open_questions: [] }, []),
    ).toEqual([]);
  });
});

describe("the instructions given to Claude", () => {
  it("forbid recommending approval or rejection (AI reads, a human decides)", () => {
    expect(EVIDENCE_SYSTEM_PROMPT).toMatch(/do not recommend approving or rejecting/i);
  });

  it("restrict Claude to the provided sources and forbid invented ids", () => {
    expect(EVIDENCE_SYSTEM_PROMPT).toMatch(/use only the sources provided/i);
    expect(EVIDENCE_SYSTEM_PROMPT).toMatch(/never invent a source_id/i);
  });
});
