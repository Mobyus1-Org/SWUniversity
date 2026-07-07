import type { UserResponse } from "@/util/func";

export type VariantLike = { difficulty: number };

export function isQuizFinished(id: number, mastered: Set<string>): boolean {
  return mastered.has(String(id));
}

export function isDykswuCardFinished(
  id: number,
  fullVariants: VariantLike[],
  difficulty: number,
  mastered: Set<string>,
): boolean {
  const matchingIndices = fullVariants
    .map((variant, index) => ({ variant, index }))
    .filter(({ variant }) => variant.difficulty === difficulty)
    .map(({ index }) => index);

  if (matchingIndices.length === 0) {
    return false;
  }

  return matchingIndices.every((index) => mastered.has(`${id}:${index}`));
}

export function modeDifficultyIndex(mode: string): number | null {
  if (mode === "padawan") return 0;
  if (mode === "knight") return 1;
  if (mode === "master") return 2;
  return null;
}

export function standardMasteryKeys(app: "quiz" | "dykswu", responses: UserResponse[]): string[] {
  const keys: string[] = [];
  for (const response of responses) {
    const mainCorrect = response.selected === response.correct;
    if (!mainCorrect) continue;

    if (app === "quiz") {
      keys.push(String(response.modeId));
      continue;
    }

    const followUpOk = !response.followUp
      || response.followUp.followUpSelected === response.followUp.followUpCorrect;
    if (followUpOk) {
      keys.push(`${response.modeId}:${response.variant ?? 0}`);
    }
  }
  return keys;
}
