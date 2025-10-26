import { getDoYouKnowSWUDataAsync } from "../../util/func";
import type { DYKSWUCountEntry, DYKSWUCounts } from "./api-const";

export async function apiDYKSWUCountsAsync(): Promise<DYKSWUCounts> {
  const data = await getDoYouKnowSWUDataAsync();
  const counts: DYKSWUCountEntry = {
    followUpCounts: {},
    set: {
      0: { "SOR": 0, "SHD": 0, "TWI": 0, "JTL": 0, "LOF": 0, "IBH": 0, "SEC": 0 },
      1: { "SOR": 0, "SHD": 0, "TWI": 0, "JTL": 0, "LOF": 0, "IBH": 0, "SEC": 0 },
      2: { "SOR": 0, "SHD": 0, "TWI": 0, "JTL": 0, "LOF": 0, "IBH": 0, "SEC": 0 }
    }
  };
  let totalCount = 0;
  let totalFollowUpCount = 0;

  data.forEach(question => {
    question.variants.forEach(variant => {
      const { difficulty, answer, followUp } = variant;
      const set = question.actualCard.split("/").shift() || "unknown";
      counts[difficulty] = counts[difficulty] || {};
      counts[difficulty][answer] = (counts[difficulty][answer] || 0) + 1;

      // Track set counts by difficulty
      if (set in counts.set[difficulty]) {
        counts.set[difficulty][set as keyof typeof counts.set[0]]++;
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