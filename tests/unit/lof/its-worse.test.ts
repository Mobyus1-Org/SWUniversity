import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_264 It's Worse — Event (no aspect), cost 7, Trick —
//   "Defeat a non-leader unit."
// Same text as SOR_078 Vanquish.

const ITS_WORSE = Cards.events.lof.itsWorse;
const MARINE = Cards.units.sor.battlefieldMarine;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin, true, true)
    .FillResourcesForPlayer(1, MARINE, 8)
    .WithCardInHandForPlayer(1, ITS_WORSE)
    .WithGroundUnitForPlayer(2, MARINE)
    .WithGroundUnitForPlayer(2, Cards.leaders.sor.grandMoffTarkin) // deployed leader unit
    .WithActivePlayer(1);
}

describe("LOF_264 It's Worse", () => {
  it("defeats the chosen non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const marineId = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marineId] });

    expect(g.state.player2.groundArena.some(u => u.playId === marineId)).toBe(false);
    expect(g.state.player2.discard.some(c => c.cardId === MARINE)).toBe(true);
    expect(g.state.player1.discard.some(c => c.cardId === ITS_WORSE)).toBe(true);
  });

  it("does not offer a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const leaderId = g.state.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player2.groundArena[0].playId]);
    expect(res.fromPlayIds).not.toContain(leaderId);
  });
});
