import { describe, it, expect } from "vitest";
import {
  DEFAULT_ALTERNATE_FAIL_EXPLANATION,
  fromRaw,
  initialBuilderState,
} from "@/components/Shared/puzzle-builder-state";

// Surviving to regroup used to hard-error for the player when a puzzle had no authored
// explanation. The editor now pre-fills a generic "report it on Discord" message so no puzzle can
// ship without one — authors override it only when that loss is a designed outcome.
describe("alternate fail explanation default", () => {
  it("pre-fills a new puzzle", () => {
    expect(initialBuilderState().alternateFailExplanation).toBe(DEFAULT_ALTERNATE_FAIL_EXPLANATION);
  });

  it("fills the gap when an older puzzle is opened without one", () => {
    const meta = { name: "Old", description: "", difficulty: 1 };
    expect(fromRaw({}, meta).alternateFailExplanation).toBe(DEFAULT_ALTERNATE_FAIL_EXPLANATION);
  });

  it("fills the gap when the stored value is blank", () => {
    const meta = { name: "Old", description: "", difficulty: 1, alternateFailExplanation: "   " };
    expect(fromRaw({}, meta).alternateFailExplanation).toBe(DEFAULT_ALTERNATE_FAIL_EXPLANATION);
  });

  it("keeps an authored explanation untouched", () => {
    const meta = { name: "Authored", description: "", difficulty: 1, alternateFailExplanation: "Kylo kills you next turn." };
    expect(fromRaw({}, meta).alternateFailExplanation).toBe("Kylo kills you next turn.");
  });
});
