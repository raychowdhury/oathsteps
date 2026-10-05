import { describe, expect, it } from "vitest";
import { compareWords, describeDiff } from "./writing";

describe("writing word comparison", () => {
  it("matches ignoring case and punctuation", () => {
    const d = compareWords("Washington, D.C. is the capital of the United States.", "washington dc is the capital of the united states");
    expect(d.diffs).toBe(0);
    expect(describeDiff(d)).toBe("Matches the sentence");
  });

  it("marks the differing word and keeps the original spelling for display", () => {
    const d = compareWords("Washington was the first President.", "Washington was the frist president");
    expect(d.diffs).toBe(1);
    expect(d.words.map((w) => w.ok)).toEqual([true, true, true, false, true]);
    expect(d.words[3].t).toBe("first");
    expect(describeDiff(d)).toBe("1 word different");
  });

  it("counts missing and extra words", () => {
    expect(compareWords("Independence Day is in July.", "Independence Day is in").diffs).toBe(1);
    expect(compareWords("Independence Day is in July.", "Independence Day is in July every year").diffs).toBe(2);
  });
});
