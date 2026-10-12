import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { findCandidate, imageUrl } = await import("./detail");

describe("findCandidate", () => {
  it("finds a mock candidate by hid", () => {
    expect(findCandidate("9990000003")?.hotel.name).toBe("The Rose Stay (mock)");
  });

  it("includes the candidate's reviews and press", () => {
    expect(findCandidate("9990000003")?.external.length).toBeGreaterThan(0);
  });

  it.each(["", "abc", "9990000003; drop table", "-1", "1e10", "99999999999999999999", "123"])(
    "returns null for %j",
    (value) => {
      expect(findCandidate(value)).toBeNull();
    },
  );
});

describe("imageUrl", () => {
  it("fills RateHawk's {size} placeholder", () => {
    expect(imageUrl("/mock/hotel-photo.svg?size={size}&n=1", "320x200")).toBe(
      "/mock/hotel-photo.svg?size=320x200&n=1",
    );
  });
});
