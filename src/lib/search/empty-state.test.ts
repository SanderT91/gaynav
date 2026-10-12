import { describe, expect, it } from "vitest";
import { emptyState } from "./empty-state";

const query = { checkin: "2026-12-01", checkout: "2026-12-05", adults: 2 };

describe("emptyState", () => {
  it("explains a deliberately small catalogue when nothing is approved anywhere", () => {
    const s = emptyState({ approvedAnywhere: 0, query });
    expect(s.title).toMatch(/hand-picked/);
    expect(s.body).toMatch(/reviewed by our team/);
    expect(s.action).toBeUndefined();
  });

  it("says the same for a city search when nothing is approved anywhere", () => {
    expect(emptyState({ city: "Rome", approvedAnywhere: 0, query }).title).toMatch(/hand-picked/);
  });

  it("points to other cities, keeping the dates and guests, when only this city is empty", () => {
    const s = emptyState({ city: "Rome", approvedAnywhere: 3, query });
    expect(s.title).toBe("No hotels in Rome yet");
    expect(s.action).toEqual({
      label: "See all cities",
      href: "/search?checkin=2026-12-01&checkout=2026-12-05&adults=2",
    });
  });

  it("never uses error-like wording", () => {
    for (const s of [
      emptyState({ approvedAnywhere: 0, query }),
      emptyState({ city: "Rome", approvedAnywhere: 2, query }),
    ]) {
      expect(`${s.title} ${s.body}`).not.toMatch(/error|failed|wrong|broken|not found/i);
    }
  });
});
