import { getQuizDataAsync } from "../../util/func";
import type { QuizCountEntry, QuizCounts } from "./api-const";

export async function apiQuizCountsAsync(): Promise<QuizCounts> {
  const data = await getQuizDataAsync();
  const counts: QuizCountEntry = {};
  let totalCount = 0;

  data.forEach(quiz => {
    const { difficulty, answer } = quiz;
    counts[difficulty] = counts[difficulty] || {};
    counts[difficulty][answer] = (counts[difficulty][answer] || 0) + 1;

    totalCount++;
  });

  return { counts, totalCount };
}
