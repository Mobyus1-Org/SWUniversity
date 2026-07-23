export type WizardStepId = "info" | "boards" | "p1" | "p2" | "solution" | "preview";

export const STEP_LABELS: Record<WizardStepId, string> = {
  info: "Info",
  boards: "Boards",
  p1: "P1 Board",
  p2: "P2 Board",
  solution: "Solution",
  preview: "Preview",
};

/**
 * Ordered wizard steps for the current viewport. Desktop shows P1 and P2 boards on one
 * "boards" step; mobile splits them into two ("p1", "p2").
 */
export function buildStepList(isWide: boolean): WizardStepId[] {
  return isWide
    ? ["info", "boards", "solution", "preview"]
    : ["info", "p1", "p2", "solution", "preview"];
}
