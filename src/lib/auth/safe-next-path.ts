// Where to send someone after signing in, taken from a `?next=` parameter.
//
// Only same-site relative paths are allowed. Anything else — absolute URLs,
// protocol-relative `//evil.example`, backslash tricks like `/\evil.example`,
// or control characters — falls back to the default. Without this, a crafted
// login link could bounce a freshly signed-in user to a phishing site
// (an "open redirect").
export function safeNextPath(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  return next;
}
