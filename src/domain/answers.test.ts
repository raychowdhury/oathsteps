import { describe, expect, it } from "vitest";
import { buildMultipleChoice, expandVariants, matchesAnyAnswer, normalize } from "./answers";
import { seededRng } from "./rng";

describe("answer variants", () => {
  it("expands optional parenthetical words", () => {
    expect(expandVariants("(U.S.) Constitution").sort()).toEqual(["constitution", "u s constitution"]);
    expect(expandVariants("Senate and House (of Representatives)")).toContain("senate and house");
    expect(expandVariants("Twenty-seven (27)")).toEqual(expect.arrayContaining(["twenty seven 27", "twenty seven"]));
  });

  it("matches learner text against any accepted variant as a hint", () => {
    const answers = [{ text: "(U.S.) Constitution" }];
    expect(matchesAnyAnswer("the constitution", answers)).toBe(true);
    expect(matchesAnyAnswer("US Constitution!", answers)).toBe(true);
    expect(matchesAnyAnswer("declaration of independence", answers)).toBe(false);
    expect(matchesAnyAnswer("", answers)).toBe(false);
    expect(normalize("The Star-Spangled Banner")).toBe("star spangled banner");
  });
});

describe("multiple choice", () => {
  const pool = [
    { id: "a", subsection: "S1", answers: [{ text: "Republic" }, { text: "Representative democracy" }] },
    { id: "b", subsection: "S1", answers: [{ text: "(U.S.) Constitution" }] },
    { id: "c", subsection: "S1", answers: [{ text: "Amendments" }] },
    { id: "d", subsection: "S2", answers: [{ text: "Capitalism" }] },
    { id: "e", subsection: "S2", answers: [{ text: "Answers will vary." }], dynamic: { kind: "governor" } },
  ];

  it("builds four options with the correct answer and no same-question variants", () => {
    const mc = buildMultipleChoice(pool[0], pool, seededRng(1));
    expect(mc).not.toBeNull();
    expect(mc!.options).toHaveLength(4);
    expect(mc!.options).toContain("Republic");
    expect(mc!.options).not.toContain("Representative democracy");
    expect(mc!.options).not.toContain("Answers will vary.");
  });

  it("refuses dynamic questions", () => {
    expect(buildMultipleChoice(pool[4], pool, seededRng(1))).toBeNull();
  });

  it("is reproducible for a seed", () => {
    expect(buildMultipleChoice(pool[1], pool, seededRng(5))).toEqual(buildMultipleChoice(pool[1], pool, seededRng(5)));
  });
});
