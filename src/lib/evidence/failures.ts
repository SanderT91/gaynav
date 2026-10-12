import Anthropic from "@anthropic-ai/sdk";

// Every way an evidence pack can fail, with a plain-language message for staff
// and whether trying again could help. A failed pack is never shown as a
// summary — not blank, not partial, not "best effort" (CLAUDE.md, Epic 1.2).

export type EvidenceFailureReason =
  | "no_sources" // nothing to summarise — the AI is never asked to invent something
  | "not_configured" // ANTHROPIC_API_KEY missing
  | "refused" // Claude (and its fallback) declined the request
  | "truncated" // the reply hit the length limit — would be incomplete
  | "unparseable" // the reply didn't match the evidence-pack format
  | "incomplete" // matched the format but is missing a summary
  | "invalid_citations" // cited a source it wasn't given, or none at all
  | "rate_limited" // too many requests right now
  | "unavailable" // Claude API down, overloaded or unreachable, or timed out
  | "rejected"; // the API refused the request itself (bad key, bad request, billing)

export type EvidenceFailure = {
  ok: false;
  reason: EvidenceFailureReason;
  /** Shown to staff. */
  message: string;
  /** Whether pressing "try again" could plausibly work. */
  retryable: boolean;
  /** For logs only — never shown in the UI, never contains the API key. */
  detail: string;
};

const MESSAGES: Record<EvidenceFailureReason, { message: string; retryable: boolean }> = {
  no_sources: {
    message:
      "There is no description, policy, review or press coverage for this hotel to summarise. Review it manually.",
    retryable: false,
  },
  not_configured: {
    message: "AI evidence packs aren't set up yet (the Claude API key is missing). Ask an admin.",
    retryable: false,
  },
  refused: {
    message: "The AI declined to summarise this hotel. Review the sources manually.",
    retryable: false,
  },
  truncated: {
    message: "The AI's summary was cut off before it finished, so it wasn't saved. Try again.",
    retryable: true,
  },
  unparseable: {
    message: "The AI's reply wasn't in the expected format, so it wasn't saved. Try again.",
    retryable: true,
  },
  incomplete: {
    message: "The AI's reply was missing its summary, so it wasn't saved. Try again.",
    retryable: true,
  },
  invalid_citations: {
    message:
      "The AI cited sources that don't exist, so the summary can't be trusted and wasn't saved. Try again.",
    retryable: true,
  },
  rate_limited: {
    message: "Too many AI requests right now. Wait a minute and try again.",
    retryable: true,
  },
  unavailable: {
    message: "The AI service is unavailable at the moment. Try again in a few minutes.",
    retryable: true,
  },
  rejected: {
    message:
      "The AI service rejected the request. Ask an admin to check the Claude API key and account.",
    retryable: false,
  },
};

export function evidenceFailure(reason: EvidenceFailureReason, detail: string): EvidenceFailure {
  return { ok: false, reason, detail, ...MESSAGES[reason] };
}

/**
 * Turns an exception from the Claude call into a failure. Most-specific
 * class first: in the TypeScript SDK, connection errors are subclasses of
 * APIError, so they must be checked before it.
 */
export function failureFromError(error: unknown): EvidenceFailure {
  if (error instanceof Error && error.message.startsWith("ANTHROPIC_API_KEY is not set")) {
    return evidenceFailure("not_configured", error.message);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return evidenceFailure("rate_limited", `429: ${error.message}`);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    // Includes APIConnectionTimeoutError.
    return evidenceFailure("unavailable", `connection: ${error.message}`);
  }
  if (error instanceof Anthropic.InternalServerError) {
    return evidenceFailure("unavailable", `${error.status}: ${error.message}`);
  }
  if (error instanceof Anthropic.APIError) {
    // 400 bad request, 401 bad key, 402 billing, 403 permission, 404 model…
    return evidenceFailure("rejected", `${error.status ?? "?"}: ${error.message}`);
  }
  return evidenceFailure("unavailable", error instanceof Error ? error.message : String(error));
}
