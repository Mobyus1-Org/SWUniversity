// This API endpoint returns the answer counts for each quiz difficulty level including follow ups
import { getDoYouKnowSWUDataAsync } from "../../util/func";

export async function apiDYKSWUCountsAsync() {
  const data = await getDoYouKnowSWUDataAsync();
  const counts: any = { followUpCounts: {} };
  let totalCount = 0;
  let totalFollowUpCount = 0;

  data.forEach(question => {
    question.variants.forEach(variant => {
      const { difficulty, answer, followUp } = variant;

      // Initialize difficulty object if needed
      counts[difficulty] = counts[difficulty] || {};
      // Initialize answer count if needed
      counts[difficulty][answer] = (counts[difficulty][answer] || 0) + 1;

      totalCount++;

      // Handle follow-up question if it exists
      if (followUp) {
        counts.followUpCounts[difficulty] = counts.followUpCounts[difficulty] || {};
        counts.followUpCounts[difficulty][followUp.answer] = (counts.followUpCounts[difficulty][followUp.answer] || 0) + 1;

        totalFollowUpCount++;
      }
    });
  });

  return { counts, totalCount, totalFollowUpCount };
}