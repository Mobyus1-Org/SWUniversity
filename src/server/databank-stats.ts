import { readFile } from "fs/promises";
import path from "path";

import {
  computeQuizDatabank,
  computeDykswuDatabank,
  type QuizPoolItem,
  type DykswuPoolItem,
} from "@/util/databank-completion";
import type { DatabankCompletion } from "@/util/profile-data";

async function readJsonFile<T>(fileName: string): Promise<T> {
  const filePath = path.join(process.cwd(), "public", fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export type DatabankCompletionResult = {
  quiz: DatabankCompletion;
  dykswu: DatabankCompletion;
};

export async function computeDatabankCompletion(
  masteredQuizIds: string[],
  masteredDykswuIds: string[],
): Promise<DatabankCompletionResult> {
  const [quizPool, dykswuPool] = await Promise.all([
    readJsonFile<QuizPoolItem[]>("quiz-database.json"),
    readJsonFile<DykswuPoolItem[]>("dykswu-database.json"),
  ]);

  return {
    quiz: computeQuizDatabank(masteredQuizIds, quizPool.filter((q) => typeof q.id === "number")),
    dykswu: computeDykswuDatabank(masteredDykswuIds, dykswuPool.filter((q) => typeof q.id === "number")),
  };
}
