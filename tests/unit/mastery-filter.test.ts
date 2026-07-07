import { describe, it, expect } from "vitest";
import { isQuizFinished, isDykswuCardFinished, modeDifficultyIndex, standardMasteryKeys } from "@/util/mastery-filter";
import type { UserResponse } from "@/util/func";

describe("isQuizFinished", () => {
  it("is true when the id is in the mastered set", () => {
    expect(isQuizFinished(12, new Set(["12"]))).toBe(true);
  });
  it("is false when the id is absent", () => {
    expect(isQuizFinished(12, new Set(["13"]))).toBe(false);
  });
});

describe("isDykswuCardFinished", () => {
  const variants = [
    { difficulty: 0 }, // index 0 padawan
    { difficulty: 1 }, // index 1 knight
    { difficulty: 0 }, // index 2 padawan
  ];

  it("is true only when every same-difficulty variant is mastered", () => {
    expect(isDykswuCardFinished(5, variants, 0, new Set(["5:0", "5:2"]))).toBe(true);
  });
  it("is false when one same-difficulty variant is missing", () => {
    expect(isDykswuCardFinished(5, variants, 0, new Set(["5:0"]))).toBe(false);
  });
  it("checks only the requested difficulty", () => {
    expect(isDykswuCardFinished(5, variants, 1, new Set(["5:1"]))).toBe(true);
  });
  it("is false when the card has no variants at that difficulty", () => {
    expect(isDykswuCardFinished(5, variants, 2, new Set())).toBe(false);
  });
});

describe("modeDifficultyIndex", () => {
  it("maps difficulty modes to indices", () => {
    expect(modeDifficultyIndex("padawan")).toBe(0);
    expect(modeDifficultyIndex("knight")).toBe(1);
    expect(modeDifficultyIndex("master")).toBe(2);
  });
  it("returns null for non-difficulty modes", () => {
    expect(modeDifficultyIndex("standard")).toBeNull();
    expect(modeDifficultyIndex("")).toBeNull();
  });
});

describe("standardMasteryKeys", () => {
  it("returns String(id) for each correct quiz response", () => {
    const responses: UserResponse[] = [
      { modeId: 3, selected: "a", correct: "a" },
      { modeId: 4, selected: "b", correct: "a" },
      { modeId: 7, selected: "c", correct: "c" },
    ];
    expect(standardMasteryKeys("quiz", responses)).toEqual(["3", "7"]);
  });

  it("returns id:variant for fully-correct dykswu responses only", () => {
    const responses: UserResponse[] = [
      { modeId: 10, variant: 2, selected: "a", correct: "a" }, // no follow-up, correct
      { modeId: 11, variant: 0, selected: "a", correct: "a", followUp: { followUpSelected: "x", followUpCorrect: "x" } }, // follow-up correct
      { modeId: 12, variant: 1, selected: "a", correct: "a", followUp: { followUpSelected: "y", followUpCorrect: "z" } }, // follow-up wrong -> excluded
      { modeId: 13, variant: 0, selected: "a", correct: "b" }, // main wrong -> excluded
    ];
    expect(standardMasteryKeys("dykswu", responses)).toEqual(["10:2", "11:0"]);
  });
});
