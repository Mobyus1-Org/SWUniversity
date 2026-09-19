import type { GameState } from "@/lib/engine/game";

/**
 * Links each deployed leader to what it deployed as, when a loaded state leaves that out.
 *
 * In play, deploying sets `leader.deployedPlayId` to the leader's unit (or, for a leader deployed as
 * a Pilot, to the upgrade carrying it). A state authored rather than played — a puzzle built with
 * its leader already deployed, a test fixture — has `deployed: true` and the unit in an arena but no
 * link, so anything that finds the deployed leader through it (HMW_004 The Death Star's regroup
 * ability, ability-loss checks) found nothing. Only fills a missing link; never changes one.
 */
export function LinkDeployedLeaders(gs: GameState): void {
  for (const p of [gs.player1, gs.player2]) {
    const leader = p.leader;
    if (!leader.deployed || leader.deployedPlayId) continue;
    const units = [...p.groundArena, ...p.spaceArena];
    const asUnit = units.find(u => u.cardId === leader.cardId);
    const asPilot = units.flatMap(u => u.upgrades).find(u => u.cardId === leader.cardId);
    leader.deployedPlayId = (asUnit ?? asPilot)?.playId;
  }
}
