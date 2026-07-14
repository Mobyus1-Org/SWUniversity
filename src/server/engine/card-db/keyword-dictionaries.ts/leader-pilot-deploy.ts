/**
 * Leaders that can deploy as a PILOT upgrade on a friendly Vehicle unit.
 * Value = minimum resource count the player must control (total, ready+exhausted)
 * to trigger the "Deploy as Unit / Deploy as Pilot" choice.
 *
 * Note: Poe Dameron (JTL_013) is NOT listed here — he attaches via a leader ability
 * (use-ability → flip leader), not via the deploy epic action.
 */
const leaderDeployPilotThresholdByCardId: Record<string, number> = {
  "JTL_001": 6, // Asajj Ventress — "If you control 6 or more resources, choose one: Deploy / Deploy as upgrade"
  "JTL_012": 6, // Luke Skywalker (Hero of Yavin) — same choose-one epic action
  "JTL_018": 4, // Kazuda Xiono (Best Pilot in the Galaxy) — same choose-one epic action
};

export function LeaderDeployPilotThreshold(cardId: string): number | null {
  return leaderDeployPilotThresholdByCardId[cardId] ?? null;
}
