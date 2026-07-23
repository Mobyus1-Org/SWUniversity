import { describe, it, expect } from "vitest";
import { buildStepList, STEP_LABELS } from "@/components/Shared/puzzle-wizard-steps";

describe("buildStepList", () => {
  it("desktop (wide) has 4 steps with boards combined", () => {
    expect(buildStepList(true)).toEqual(["info", "boards", "solution", "preview"]);
  });

  it("mobile (narrow) has 5 steps with the boards split into p1/p2", () => {
    expect(buildStepList(false)).toEqual(["info", "p1", "p2", "solution", "preview"]);
  });

  it("every step id in both layouts has a label", () => {
    for (const id of [...buildStepList(true), ...buildStepList(false)]) {
      expect(STEP_LABELS[id]).toBeTruthy();
    }
  });
});
