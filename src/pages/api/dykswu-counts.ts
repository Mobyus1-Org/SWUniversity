import { getDoYouKnowSWUDataAsync } from "../../util/func";
import type { DYKSWUCountEntry, DYKSWUCounts } from "./api-const";

export async function apiDYKSWUCountsAsync(): Promise<DYKSWUCounts> {
  const data = await getDoYouKnowSWUDataAsync();
  const counts: DYKSWUCountEntry = { followUpCounts: {}, set: {
    "SOR": 0,
    "SHD": 0,
    "TWI": 0,
    "JTL": 0,
    "LOF": 0,
    "IBH": 0,
    "SEC": 0,
  } };
  let totalCount = 0;
  let totalFollowUpCount = 0;

  data.forEach(question => {
    question.variants.forEach(variant => {
      const { difficulty, answer, followUp } = variant;
      const set = question.actualCard.split("/").shift() || "unknown";
      counts[difficulty] = counts[difficulty] || {};
      counts[difficulty][answer] = (counts[difficulty][answer] || 0) + 1;
      if (set in counts.set) {
        counts.set[set as keyof typeof counts.set]++;
      }
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