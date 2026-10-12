import { EvidencePackSchema, type EvidencePack } from "./schema";

/**
 * Parses the reply text against the evidence-pack schema. Returns null instead
 * of throwing, so the caller can first check *why* the model stopped (a
 * truncated reply is "truncated", not "unparseable").
 */
export function parseEvidenceReply(text: string): EvidencePack | null {
  try {
    const result = EvidencePackSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
