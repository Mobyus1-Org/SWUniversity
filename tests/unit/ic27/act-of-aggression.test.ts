import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// IC27_127 Act of Aggression (Event, cost 4, Aggression/Aggression)
//   "Draw a card. You may deal 3 damage to a unit. Give a friendly unit +3/+0 and Overwhelm for
//    this phase."

const AOA = Cards.events.ic27.actOfAggression;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const CSF = Cards.units.sor.consularSecurityForce; // 3/7

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, AOA)
    .WithCardInDeckForPlayer(1, MARINE);
}

const res = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[] } | undefined;

describe("IC27_127 Act of Aggression", () => {
  it("draws, deals 3, then gives a friendly unit +3/+0 and Overwhelm", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.hand).toHaveLength(1);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player2.groundArena).toHaveLength(0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    const csf = g.state.player1.groundArena[0];
    expect(Unit.FromInterface(csf).CurrentPower()).toBe(6);
    expect(HasOverwhelm(CSF, csf.playId, 1)).toBe(true);
  });

  it("declining the damage still gives the buff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(6);
  });

  it("the buff pool is friendly units only, built after the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, CSF)
      .WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] }); // own Marine dies

    expect(res(g)?.fromPlayIds).toEqual([g.state.player1.groundArena.find(u => u.cardId === CSF)!.playId]);
  });

  it("with no friendly unit, the draw and damage still happen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(res(g)).toBeFalsy();
  });
});
