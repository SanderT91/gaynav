import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

// safeNextPath decides where someone lands after signing in. If it ever let an
// outside URL through, a crafted GAYNAV login link could forward a freshly
// signed-in user to a look-alike phishing site (an "open redirect").
describe("safeNextPath", () => {
  it.each(["/account", "/staff", "/staff/mfa?next=%2Fstaff", "/search?city=london#results"])(
    "keeps the same-site path %s",
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    ["absolute https URL", "https://evil.example/phish"],
    ["absolute http URL", "http://evil.example"],
    ["protocol-relative URL", "//evil.example/phish"],
    ["backslash trick", "/\\evil.example"],
    ["backslash later in the path", "/account\\..\\evil"],
    ["javascript: URL", "javascript:alert(1)"],
    ["relative path without leading slash", "account"],
    ["newline injection", "/account\nLocation: https://evil.example"],
    ["tab character", "/\t/evil.example"],
    ["null byte", "/account\u0000"],
    ["empty string", ""],
    ["overly long value", `/${"a".repeat(3000)}`],
  ])("rejects a %s", (_label, value) => {
    expect(safeNextPath(value)).toBe("/account");
  });

  it.each([undefined, null, 42, ["/account"], { path: "/account" }])(
    "rejects a non-string value (%j)",
    (value) => {
      expect(safeNextPath(value)).toBe("/account");
    },
  );

  it("uses the caller's fallback when given one", () => {
    expect(safeNextPath("//evil.example", "/staff")).toBe("/staff");
  });
});
