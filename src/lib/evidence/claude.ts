import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { EVIDENCE_SYSTEM_PROMPT } from "./prompt";
import { EvidencePackSchema, type EvidencePack } from "./schema";

// The one place GAYNAV talks to the Claude API. Server-only: the API key is
// read from the server environment and this module can't be imported into
// browser code (the "server-only" import makes that a build error).

export const EVIDENCE_MODEL = "claude-opus-5-5";

/** What the generator needs back from one Claude call. */
export type ClaudeEvidenceReply = {
  stop_reason: string | null;
  /** null when the reply couldn't be parsed into the schema. */
  parsed: EvidencePack | null;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

export type CallClaude = (userMessage: string) => Promise<ClaudeEvidenceReply>;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (local) or Vercel's environment variables.",
    );
  }
  client ??= new Anthropic({ apiKey });
  return client;
}

export const callClaude: CallClaude = async (userMessage) => {
  const response = await getClient().beta.messages.parse({
    model: EVIDENCE_MODEL,
    max_tokens: 16000,
    // Vetting evidence deserves careful reading; Opus 5.5 defaults to medium.
    output_config: { effort: "high", format: betaZodOutputFormat(EvidencePackSchema) },
    // If a safety classifier declines, Anthropic retries on its recommended
    // fallback model inside the same call instead of returning a refusal.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // The fixed instructions are identical on every call: cache them.
    system: [{ type: "text", text: EVIDENCE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  });

  return {
    stop_reason: response.stop_reason,
    parsed: response.parsed_output ?? null,
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
};
