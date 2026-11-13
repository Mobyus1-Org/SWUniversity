import { describe, it, expect } from "vitest";
import { fromRaw, initialBuilderState } from "@/components/Shared/puzzle-builder-state";

// An optional author note shown under the byline in the solved/solution dialog (e.g. "This was a
// real game state at the Baltimore Sector Qualifier"). Unlike the alternate fail explanation it has
// no default — blank means the dialog shows nothing.
describe("solution comment", () => {
  it("starts blank on a new puzzle", () => {
    expect(initialBuilderState().solutionComment).toBe("");
  });

  it("reads as blank when an older puzzle is opened without one", () => {
    const meta = { name: "Old", description: "", difficulty: 1 };
    expect(fromRaw({}, meta).solutionComment).toBe("");
  });

  it("keeps an authored comment when the puzzle is reopened in the editor", () => {
    const meta = { name: "Authored", description: "", difficulty: 1, solutionComment: "A real Sector Qualifier board state!" };
    expect(fromRaw({}, meta).solutionComment).toBe("A real Sector Qualifier board state!");
  });
});
