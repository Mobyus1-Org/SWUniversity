import { getQuizDataAsync } from "../../util/func";

export async function apiQuizCountsAsync() {
  const data = await getQuizDataAsync();
  const counts: Record<number, Record<string, number>> = {};
  let totalCount = 0;

  data.forEach(quiz => {
    const { difficulty, answer } = quiz;

    // Initialize difficulty object if needed
    counts[difficulty] = counts[difficulty] || {};
    // Initialize answer count if needed
    counts[difficulty][answer] = (counts[difficulty][answer] || 0) + 1;

    totalCount++;
  });

  return { counts, totalCount };
}
