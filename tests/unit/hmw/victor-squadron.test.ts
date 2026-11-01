import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_203 Victor Squadron — In Attack Formation (5/5 Space, cost 6, Cunning/Villainy, unique) —
//   "This unit enters play ready."
// The same clause SOR_193 Millennium Falcon prints (without the Falcon's regroup upkeep).

const VICTOR = Cards.units.hmw.victorSquadron;

function board(handCard: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14) // covers aspect penalties
    .WithCardInHandForPlayer(1, handCard)
    .WithActivePlayer(1);
}

describe("HMW_203 Victor Squadron", () => {
  it("enters play ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(VICTOR).Build());
    await g.playCardFromHandAsync(1, 0);
    const unit = g.state.player1.spaceArena.find(u => u.cardId === VICTOR);
    expect(unit).toBeDefined();
    expect(unit!.ready).toBe(true);
  });

  it("can attack the turn it is played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(VICTOR).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithSpaceUnitAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("control: a unit without the clause enters exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.units.ibh.scoutingTieFighter).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.spaceArena[0].ready).toBe(false);
  });
});
