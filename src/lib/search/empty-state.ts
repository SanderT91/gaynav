// What a search with no results says (Epic 2.1). At launch the catalogue is
// deliberately small and hand-picked, so "nothing found" is normal and must
// read as intentional, never as a broken page.

export type EmptyState = {
  title: string;
  body: string;
  /** Where to go next, if there is somewhere useful. */
  action?: { label: string; href: string };
};

export function emptyState(input: {
  city?: string;
  /** Approved hotels across ALL cities, ignoring the city filter. */
  approvedAnywhere: number;
  /** The current search's dates and guests, kept when switching city. */
  query: { checkin: string; checkout: string; adults: number };
}): EmptyState {
  const keep = new URLSearchParams({
    checkin: input.query.checkin,
    checkout: input.query.checkout,
    adults: String(input.query.adults),
  });

  if (input.city && input.approvedAnywhere > 0) {
    return {
      title: `No hotels in ${input.city} yet`,
      body: `We only list hotels our team has checked are genuinely welcoming to LGBTQ+ travellers, so ${input.city} is still being curated. We do have hotels in other cities for these dates.`,
      action: { label: "See all cities", href: `/search?${keep}` },
    };
  }

  return {
    title: "Our first hotels are being hand-picked",
    body: "Every hotel on GAYNAV is reviewed by our team before it's listed, so we're starting small on purpose. Please check back soon — new hotels are added as soon as they pass our review.",
  };
}
