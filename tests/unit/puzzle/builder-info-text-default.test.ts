import { describe, it, expect } from "vitest";
import {
  DEFAULT_INFO_TEXT,
  infoTextForWinCondition,
  initialBuilderState,
} from "@/components/Shared/puzzle-builder-state";

// The Info Text default used to be the Find Lethal copy for every mode. Picking a mode now swaps in
// that mode's default — but only while the author hasn't written their own.
describe("info text default per win condition", () => {
  it("pre-fills a new puzzle with the Find Lethal copy", () => {
    expect(initialBuilderState().infoText).toBe(DEFAULT_INFO_TEXT["deal-lethal"]);
  });

  it("swaps an untouched default for the picked mode's default", () => {
    expect(infoTextForWinCondition(DEFAULT_INFO_TEXT["deal-lethal"], "clear-board")).toBe(
      "Your opponent has claimed the Initiative.\nRemove all of their units from play to solve the puzzle!",
    );
    expect(infoTextForWinCondition(DEFAULT_INFO_TEXT["clear-board"], "heal-full")).toBe(
      "Your opponent has claimed the Initiative.\nHeal your base back to full HP to solve the puzzle!",
    );
    expect(infoTextForWinCondition(DEFAULT_INFO_TEXT["heal-full"], "self-lethal")).toBe(
      "Your opponent has claimed the Initiative.\nReduce your own base to 0 HP to solve the puzzle!",
    );
    expect(infoTextForWinCondition(DEFAULT_INFO_TEXT["self-lethal"], "deal-lethal")).toBe(DEFAULT_INFO_TEXT["deal-lethal"]);
  });

  it("never overwrites authored info text", () => {
    expect(infoTextForWinCondition("Kylo is watching. Win.", "clear-board")).toBe("Kylo is watching. Win.");
  });

  it("leaves a deliberately blank info text blank", () => {
    expect(infoTextForWinCondition("", "heal-full")).toBe("");
  });
});
