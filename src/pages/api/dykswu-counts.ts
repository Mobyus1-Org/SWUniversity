import { getDoYouKnowSWUDataAsync } from "../../util/func";
import type { DYKSWUCountEntry, DYKSWUCounts } from "./api-const";

export async function apiDYKSWUCountsAsync(): Promise<DYKSWUCounts> {
  const data = await getDoYouKnowSWUDataAsync();
  const counts: DYKSWUCountEntry = { followUpCounts: {} };
  let totalCount = 0;
  let totalFollowUpCount = 0;

  data.forEach(question => {
    question.variants.forEach(variant => {
      const { difficulty, answer, followUp } = variant;
      counts[difficulty] = counts[difficulty] || {};
      counts[difficulty][answer] = (counts[difficulty][answer] || 0) + 1;
      totalCount++;

      if (followUp) {
        counts.followUpCounts[difficulty] = counts.followUpCounts[difficulty] || {};
        counts.followUpCounts[difficulty][followUp.answer] = (counts.followUpCounts[difficulty][followUp.answer] || 0) + 1;

        totalFollowUpCount++;
      }
    });
  });

  return { counts, totalCount, totalFollowUpCount };
}