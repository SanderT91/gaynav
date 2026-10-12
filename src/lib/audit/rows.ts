// Turns raw audit-log rows into what the staff audit view shows. Pure
// functions; loading is in load.ts.

export const DECISIONS = ["approved", "rejected", "suspended", "reinstated"] as const;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABEL: Record<Decision, string> = {
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  reinstated: "Reactivated",
};

export type DecisionRow = {
  id: number;
  hid: number;
  decision: Decision;
  note: string | null;
  concerns_acknowledged: boolean;
  public_summary: string | null;
  evidence_pack_id: string | null;
  decided_by: string;
  decided_at: string;
};

export type AuditEntry = DecisionRow & { who: string; hotel: string };

/** A display name if an admin set one, otherwise a short, stable id. */
export function whoLabel(userId: string, names: Map<string, string | null>): string {
  const name = names.get(userId);
  return name ? name : `Staff ${userId.slice(0, 8)}`;
}

export function toAuditEntries(
  rows: DecisionRow[],
  names: Map<string, string | null>,
  hotelNames: Map<number, string>,
): AuditEntry[] {
  return rows.map((row) => ({
    ...row,
    who: whoLabel(row.decided_by, names),
    hotel: hotelNames.get(row.hid) ?? `Hotel ${row.hid} (not a current candidate)`,
  }));
}

/** Filters from the URL; anything invalid is ignored rather than erroring. */
export function parseAuditFilters(params: Record<string, string | string[] | undefined>): {
  hid?: number;
  decision?: Decision;
} {
  const hidRaw = typeof params.hid === "string" ? params.hid : undefined;
  const decisionRaw = typeof params.decision === "string" ? params.decision : undefined;
  return {
    hid: hidRaw && /^\d{1,15}$/.test(hidRaw) ? Number(hidRaw) : undefined,
    decision: DECISIONS.includes(decisionRaw as Decision) ? (decisionRaw as Decision) : undefined,
  };
}
