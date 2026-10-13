// Small display helpers shared by the public pages.

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);

/** "13 Nov 2026" from "2026-11-13" or "2026-11-13T00:00:00". */
export const dateLabel = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
