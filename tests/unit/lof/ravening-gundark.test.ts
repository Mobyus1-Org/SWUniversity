import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_259 Ravening Gundark (5/4 Ground, cost 5, no aspect) —
//   "When Played: Deal 1 damage to a ground unit."
// ASH_259 LEP Ratcatcher's ability, but MANDATORY ("You may" is gone): no Yes/No offer, straight
// to the target. Any ground unit, either side — itself included.

const GUNDARK = Cards.units.lof.raveningGundark;
const ENEMY = Cards.units.sor.consularSecurityForce; // 3/7

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
    .WithCardInHandForPlayer(1, GUNDARK)
    .WithActivePlayer(1);
}

describe("LOF_259 Ravening Gundark", () => {
  it("goes straight to a target prompt — no optional offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, ENEMY).WithSpaceUnitForPlayer(2, Cards.units.ibh.scoutingTieFighter).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player2.spaceArena[0].playId); // ground only
  });

  it("deals 1 damage to the chosen ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, ENEMY).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("with no other ground unit it must damage itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    const gundarkId = g.state.player1.groundArena.find(u => u.cardId === GUNDARK)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [gundarkId] });

    expect(g.state.player1.groundArena.find(u => u.cardId === GUNDARK)!.damage).toBe(1);
  });
});
