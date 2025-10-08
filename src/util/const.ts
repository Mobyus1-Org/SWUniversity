export type QuizModes = "" | "marathon" | "endless" | "standard" | "padawan" | "knight" | "master";
export type SfxType = "click" | "hub" | "transition";
export const globalBackgroundStyle = "bg-[rgba(23,35,87,0.8)]";
export function isMarathonVariant(mode: QuizModes): boolean {
  return mode === "marathon" || mode === "padawan" || mode === "knight" || mode === "master";
}