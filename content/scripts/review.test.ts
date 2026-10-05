import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approvedFor, handwrittenHash, loadRecords, packReview, recordProblems, type ReviewRecord } from "./review";

const hash = "a".repeat(64);
const rec = (over: Partial<ReviewRecord> = {}): ReviewRecord => ({ scope: "guide", contentRef: hash, result: "approved", reviewer: { name: "A. Reviewer", credential: "Licensed attorney" }, reviewedOn: "2026-11-01", ...over });

describe("review records", () => {
  it("accepts a complete record and names every problem in an incomplete one", () => {
    expect(recordProblems(rec())).toEqual([]);
    const p = recordProblems({ scope: "everything", contentRef: "abc", result: "maybe", reviewer: { name: "", credential: "" }, reviewedOn: "yesterday" });
    expect(p).toHaveLength(5);
  });

  it("only vouches for the exact content that was reviewed", () => {
    expect(approvedFor([rec()], "guide", hash)).toBeDefined();
    expect(approvedFor([rec()], "guide", "b".repeat(64))).toBeUndefined();
    expect(approvedFor([rec()], "english", hash)).toBeUndefined();
    expect(approvedFor([rec({ result: "changes-requested" })], "guide", hash)).toBeUndefined();
  });

  it("uses the newest approval", () => {
    const newer = rec({ reviewedOn: "2026-12-01", reviewer: { name: "B", credential: "DOJ-accredited representative" } });
    expect(approvedFor([rec(), newer], "guide", hash)?.reviewer.credential).toBe("DOJ-accredited representative");
  });

  it("marks a pack reviewed only with a matching approval, and never exposes the reviewer's name", () => {
    expect(packReview([], "civics-2025", hash).humanReviewed).toBe(false);
    const r = packReview([rec({ scope: "civics-2025" })], "civics-2025", hash);
    expect(r).toMatchObject({ humanReviewed: true, reviewedAt: "2026-11-01", reviewerCredential: "Licensed attorney" });
    expect(JSON.stringify(r)).not.toContain("A. Reviewer");
  });

  it("hand-written hash ignores the version label and review block but not the content", () => {
    const base = { version: "1", review: { humanReviewed: false }, stages: [{ id: "a", text: "one" }] };
    const h = handwrittenHash(base);
    expect(handwrittenHash({ ...base, version: "2", review: { humanReviewed: true } })).toBe(h);
    expect(handwrittenHash({ ...base, stages: [{ id: "a", text: "two" }] })).not.toBe(h);
  });

  it("loads records from a folder and reports bad files", () => {
    const dir = mkdtempSync(join(tmpdir(), "oath-rec-"));
    writeFileSync(join(dir, "good.json"), JSON.stringify(rec()));
    writeFileSync(join(dir, "broken.json"), "{ nope");
    writeFileSync(join(dir, "incomplete.json"), JSON.stringify({ scope: "guide" }));
    const { records, problems } = loadRecords(dir);
    expect(records).toHaveLength(1);
    expect(problems.join("\n")).toMatch(/broken.json: not valid JSON/);
    expect(problems.join("\n")).toMatch(/incomplete.json: contentRef/);
  });
});
