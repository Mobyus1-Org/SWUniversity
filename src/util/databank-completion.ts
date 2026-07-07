import type { DifficultyKey, DatabankCompletion } from "@/util/profile-data";
import { createEmptyDatabankCompletion } from "@/util/profile-data";

export type QuizPoolItem = { id: number; difficulty: number };
export type DykswuPoolItem = { id: number; variants: Array<{ difficulty: number }> };

function difficultyKey(index: number): DifficultyKey | null {
  if (index === 0) return "padawan";
  if (index === 1) return "knight";
  if (index === 2) return "master";
  return null;
}

export function computeQuizDatabank(masteredKeys: string[], pool: QuizPoolItem[]): DatabankCompletion {
  const result = createEmptyDatabankCompletion();
  const byId = new Map<string, QuizPoolItem>();

  for (const item of pool) {
    byId.set(String(item.id), item);
    const key = difficultyKey(item.difficulty);
    if (key) result[key].total += 1;
  }

  const seen = new Set<string>();
  for (const rawKey of masteredKeys) {
    if (seen.has(rawKey)) continue;
    seen.add(rawKey);
    const item = byId.get(rawKey);
    if (!item) continue;
    const key = difficultyKey(item.difficulty);
    if (key) result[key].mastered += 1;
  }

  return result;
}

export function computeDykswuDatabank(masteredKeys: string[], pool: DykswuPoolItem[]): DatabankCompletion {
  const result = createEmptyDatabankCompletion();
  const byId = new Map<string, DykswuPoolItem>();

  for (const item of pool) {
    byId.set(String(item.id), item);
    for (const variant of item.variants) {
      const key = difficultyKey(variant.difficulty);
      if (key) result[key].total += 1;
    }
  }

  const seen = new Set<string>();
  for (const rawKey of masteredKeys) {
    if (seen.has(rawKey)) continue;
    seen.add(rawKey);
    const [idPart, variantPart] = rawKey.split(":");
    const item = byId.get(idPart);
    if (!item) continue;
    const variantIndex = Number(variantPart);
    if (!Number.isInteger(variantIndex)) continue;
    const variant = item.variants[variantIndex];
    if (!variant) continue;
    const key = difficultyKey(variant.difficulty);
    if (key) result[key].mastered += 1;
  }

  return result;
}
