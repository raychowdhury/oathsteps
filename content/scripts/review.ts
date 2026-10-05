/**
 * Human-review records. A record is a signed-off statement by a qualified reviewer that is bound to the exact
 * content it covered (a hash). Editing the content changes the hash, so an old record can never vouch for new text.
 * Records live in content/review/records/*.json (see content/review/REVIEW.md).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SCOPES = ["civics-2025", "civics-2008", "guide", "english"] as const;
export type Scope = (typeof SCOPES)[number];

export interface ReviewRecord {
  scope: Scope;
  /** Pack contentHash, or guideHash/englishHash for hand-written content. */
  contentRef: string;
  result: "approved" | "changes-requested";
  reviewer: { name: string; credential: string; organization?: string };
  /** YYYY-MM-DD */
  reviewedOn: string;
  notes?: string;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Hash of hand-written content (guide, English tasks): everything except the version label and the review block. */
export function handwrittenHash(doc: Record<string, unknown>): string {
  const { version, review, ...rest } = doc;
  void version;
  void review;
  return sha256(JSON.stringify(rest));
}

export function recordProblems(r: unknown): string[] {
  const out: string[] = [];
  const x = r as Partial<ReviewRecord> | null;
  if (!x || typeof x !== "object") return ["record is not an object"];
  if (!SCOPES.includes(x.scope as Scope)) out.push(`scope must be one of ${SCOPES.join(", ")}`);
  if (!x.contentRef || !/^[0-9a-f]{64}$/.test(x.contentRef)) out.push("contentRef must be a 64-character sha256 hex string");
  if (x.result !== "approved" && x.result !== "changes-requested") out.push('result must be "approved" or "changes-requested"');
  if (!x.reviewer?.name?.trim() || !x.reviewer?.credential?.trim()) out.push("reviewer.name and reviewer.credential are required");
  if (!x.reviewedOn || !/^\d{4}-\d{2}-\d{2}$/.test(x.reviewedOn)) out.push("reviewedOn must be YYYY-MM-DD");
  return out;
}

export function loadRecords(dir: string): { records: ReviewRecord[]; problems: string[] } {
  const records: ReviewRecord[] = [];
  const problems: string[] = [];
  if (!existsSync(dir)) return { records, problems };
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, f), "utf8"));
    } catch {
      problems.push(`${f}: not valid JSON`);
      continue;
    }
    const p = recordProblems(parsed);
    if (p.length) problems.push(...p.map((m) => `${f}: ${m}`));
    else records.push(parsed as ReviewRecord);
  }
  return { records, problems };
}

/** The newest approved record for exactly this content, if any. */
export function approvedFor(records: ReviewRecord[], scope: Scope, contentRef: string): ReviewRecord | undefined {
  return records
    .filter((r) => r.scope === scope && r.contentRef === contentRef && r.result === "approved")
    .sort((a, b) => b.reviewedOn.localeCompare(a.reviewedOn))[0];
}

export const MACHINE_ONLY_NOTE = "Wording and answers were machine-extracted from the official PDF and validated for counts and structure. No qualified human or legal review has been performed yet.";

/** The `review` block a pack gets. Reviewer names stay in the record; only the credential and date reach the app. */
export function packReview(records: ReviewRecord[], scope: Scope, contentRef: string) {
  const rec = approvedFor(records, scope, contentRef);
  if (!rec) return { machineChecked: true, humanReviewed: false, note: MACHINE_ONLY_NOTE };
  return {
    machineChecked: true,
    humanReviewed: true,
    reviewedAt: rec.reviewedOn,
    reviewerCredential: rec.reviewer.credential,
    note: "Wording and answers were machine-extracted from the official PDF and validated for counts and structure, then reviewed by a qualified reviewer.",
  };
}
