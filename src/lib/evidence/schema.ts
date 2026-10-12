import { z } from "zod";

// The structured output Claude must return for an evidence pack.
//
// Deliberately has NO approve/reject/score field (CLAUDE.md: "AI reads, a
// human decides"). The model summarises evidence and raises questions; a staff
// member makes the decision.

export const SIGNAL_TOPICS = [
  "lgbtq_welcome", // explicit inclusion, or exclusion, of LGBTQ+ guests
  "house_rules", // policies that affect who can stay or share a room
  "guest_experience", // what reviewers report about staff and stay
  "press", // news coverage
  "other",
] as const;

export const SIGNAL_TONES = ["positive", "neutral", "concern"] as const;

export const EvidenceSignalSchema = z.object({
  topic: z.enum(SIGNAL_TOPICS),
  tone: z.enum(SIGNAL_TONES),
  /** One factual sentence, grounded only in the cited sources. */
  statement: z.string(),
  /** Ids of the sources this statement rests on. At least one. */
  source_ids: z.array(z.string()),
});

export const EvidencePackSchema = z.object({
  /** 2–4 neutral sentences summarising what the evidence shows. */
  summary: z.string(),
  signals: z.array(EvidenceSignalSchema),
  /** What a human reviewer should check that the evidence can't answer. */
  open_questions: z.array(z.string()),
});

export type EvidenceSignal = z.infer<typeof EvidenceSignalSchema>;
export type EvidencePack = z.infer<typeof EvidencePackSchema>;
