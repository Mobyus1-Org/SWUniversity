import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_117 General Draven (Unit 2/5 Ground, cost 5, Command)
//   "When Played/On Attack: Create an X-Wing token."

const DRAVEN = Cards.units.jtl.generalDraven;
const XWING = Cards.units.token.xWing;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10);
}

describe("JTL_117 General Draven", () => {
  it("When Played: creates one X-Wing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, DRAVEN).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([XWING]);
  });

  it("On Attack: creates another X-Wing, and the attack still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, DRAVEN).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([XWING]);
    expect(g.state.player2.base.damage).toBe(2);
  });
});
