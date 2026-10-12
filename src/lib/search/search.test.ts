import { describe, expect, it } from "vitest";
import { mockHotelContent, mockSearchResponse } from "@/mock/ratehawk";
import { cheapestPrice, searchApproved } from "./search";

const hotels = mockHotelContent;
const search = mockSearchResponse;
const approve = (...hids: number[]) =>
  hids.map((hid) => ({ hid, vetting_summary: `Summary ${hid}` }));

const ROSE = 9990000003; // London
const DOCKLANDS = 9990000002; // London
const LANTERN = 9990000001; // Ho Chi Minh City
const PETIT_PONT_CLOSED = 9990000005;
const VICOLO_SOLD_OUT = 9990000008;
const RIVE_GAUCHE = 9990000004; // Paris, city tax not included

describe("searchApproved", () => {
  it("shows only approved hotels — never the rest of the catalogue", () => {
    const results = searchApproved({ approved: approve(ROSE, LANTERN), hotels, search });
    expect(results.map((r) => r.hid).sort()).toEqual([LANTERN, ROSE].sort());
  });

  it("shows nothing when nothing is approved, even though rates exist", () => {
    expect(searchApproved({ approved: [], hotels, search })).toEqual([]);
  });

  it("never shows a hotel that has closed since it was approved", () => {
    const results = searchApproved({ approved: approve(PETIT_PONT_CLOSED, ROSE), hotels, search });
    expect(results.map((r) => r.hid)).toEqual([ROSE]);
  });

  it("ignores approvals for hotels it has no content for", () => {
    expect(searchApproved({ approved: approve(123), hotels, search })).toEqual([]);
  });

  it("filters by city", () => {
    const results = searchApproved({
      approved: approve(ROSE, DOCKLANDS, LANTERN),
      hotels,
      search,
      city: "London",
    });
    expect(results.map((r) => r.city)).toEqual(["London", "London"]);
  });

  it("carries the public vetting summary — the staff-written text", () => {
    const [result] = searchApproved({ approved: approve(ROSE), hotels, search });
    expect(result.vettingSummary).toBe(`Summary ${ROSE}`);
  });

  it("keeps a sold-out hotel, without a price, after the available ones", () => {
    const results = searchApproved({ approved: approve(VICOLO_SOLD_OUT, ROSE), hotels, search });
    expect(results.map((r) => r.hid)).toEqual([ROSE, VICOLO_SOLD_OUT]);
    expect(results[1].price).toBeNull();
  });

  it("sorts available hotels from cheapest to most expensive", () => {
    const results = searchApproved({ approved: approve(ROSE, DOCKLANDS, LANTERN), hotels, search });
    const totals = results.map((r) => r.price!.total);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });
});

describe("cheapestPrice", () => {
  it("reports taxes that are not included as a separate amount", () => {
    const rates = search.data.hotels.find((h) => h.hid === RIVE_GAUCHE)!.rates;
    const price = cheapestPrice(rates)!;
    expect(price.excludedTaxes).toBeGreaterThan(0);
    expect(price.currency).toBe("EUR");
    expect(price.nights).toBe(2);
  });

  it("returns null when there are no rates", () => {
    expect(cheapestPrice([])).toBeNull();
  });
});
