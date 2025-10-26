import { getQuizDataAsync } from "../../util/func";
import type { QuizCountEntry, QuizCounts } from "./api-const";

export async function apiQuizCountsAsync(): Promise<QuizCounts> {
  const data = await getQuizDataAsync();
  const counts: QuizCountEntry = {};
  let totalCount = 0;
  const tagCounts: {
    [tag: string]: number;
  } = {};

  data.forEach(quiz => {
    const { difficulty, answer, tags } = quiz;
    counts[difficulty] = counts[difficulty] || {};
    tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    counts[difficulty][answer] = (counts[difficulty][answer] || 0) + 1;

    totalCount++;
  });

  //sort tag counts by count descending
  const sortedTagCounts = Object.fromEntries(
    Object.entries(tagCounts).sort(([, a], [, b]) => b - a)
  );

  return { counts, totalCount, tagCounts: sortedTagCounts };
}
