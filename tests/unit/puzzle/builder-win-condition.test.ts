import { describe, it, expect } from "vitest";
import { fromRaw, initialBuilderState } from "@/components/Shared/puzzle-builder-state";

// The editor round-trips a puzzle's goal. Puzzles saved before goals existed open as Find Lethal.
describe("puzzle builder win condition", () => {
  it("a new puzzle starts as Find Lethal", () => {
    expect(initialBuilderState().winCondition).toBe("deal-lethal");
  });

  it("an older puzzle without one opens as Find Lethal", () => {
    expect(fromRaw({}, { name: "Old", description: "", difficulty: 1 }).winCondition).toBe("deal-lethal");
  });

  it("keeps a stored goal", () => {
    const meta = { name: "Sweep", description: "", difficulty: 1, winCondition: "clear-board" as const };
    expect(fromRaw({}, meta).winCondition).toBe("clear-board");
  });
});
