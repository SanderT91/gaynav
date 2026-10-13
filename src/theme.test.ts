import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Brand values live in ONE place (CLAUDE.md, Design direction: "never as
// scattered hex values"). This keeps it that way: the pink scale may only be
// written in src/app/theme.css; everything else uses the CSS variables.

const SRC = join(__dirname);
const THEME = join(SRC, "app", "theme.css");
const BRAND_HEXES = [
  "#58032c",
  "#7d073f",
  "#a70a55",
  "#c60a66",
  "#e40d75",
  "#f04395",
  "#f882b7",
  "#fcc2db",
  "#fde8f1",
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(css|ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("design tokens", () => {
  it("defines the whole brand pink scale in theme.css", () => {
    const theme = readFileSync(THEME, "utf8").toLowerCase();
    for (const hex of BRAND_HEXES) expect(theme).toContain(hex);
  });

  it("uses no brand hex value outside theme.css", () => {
    const offenders = files(SRC)
      .filter((f) => f !== THEME)
      .flatMap((f) => {
        const text = readFileSync(f, "utf8").toLowerCase();
        return BRAND_HEXES.filter((hex) => text.includes(hex)).map(
          (hex) => `${relative(SRC, f)}: ${hex}`,
        );
      });
    expect(offenders).toEqual([]);
  });

  it("uses no hard-coded colour at all outside theme.css (only the tokens)", () => {
    const offenders = files(SRC)
      .filter((f) => f !== THEME)
      .flatMap((f) =>
        [...readFileSync(f, "utf8").matchAll(/#[0-9a-f]{3,8}\b|rgba?\(\s*\d/gi)].map(
          (m) => `${relative(SRC, f)}: ${m[0]}`,
        ),
      );
    expect(offenders).toEqual([]);
  });
});
