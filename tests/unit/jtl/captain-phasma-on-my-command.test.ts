import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// JTL_088 Captain Phasma — On My Command (Unit 5/6 Ground, cost 5, Command/Villainy)
//   "When Played/On Attack: You may give another First Order unit +2/+2 for this phase."

const PHASMA = Cards.units.jtl.captainPhasmaOnMyCommand;
const SILENCER = Cards.units.shd.kylosTieSilencer;     // 3/2 Space, First Order
const KYLO = Cards.units.shd.kyloRenKillingThePast;   // 6/7 Ground, First Order
const MARINE = Cards.units.sor.battlefieldMarine;     // not First Order

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 12);
}

const stats = (u: Parameters<typeof Unit.FromInterface>[0]) => {
  const x = Unit.FromInterface(u);
  return { power: x.CurrentPower(), hp: x.TotalHP() };
};
const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_088 Captain Phasma — On My Command", () => {
  it("When Played: another First Order unit gets +2/+2 for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, PHASMA).WithSpaceUnitForPlayer(1, SILENCER).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(stats(g.state.player1.spaceArena[0])).toEqual({ power: 5, hp: 4 });
  });

  it("offers First Order units on EITHER side — never Phasma, never non-First Order units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, PHASMA)
        .WithSpaceUnitForPlayer(1, SILENCER)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, KYLO)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect([...offer(g)].sort()).toEqual([g.state.player1.spaceArena[0].playId, g.state.player2.groundArena[0].playId].sort());
  });

  it("On Attack: does the same, and declining gives nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, PHASMA).WithSpaceUnitForPlayer(1, SILENCER).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(stats(g.state.player1.spaceArena[0])).toEqual({ power: 3, hp: 2 });
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("On Attack: accepting buffs the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, PHASMA).WithSpaceUnitForPlayer(1, SILENCER).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(stats(g.state.player1.spaceArena[0])).toEqual({ power: 5, hp: 4 });
  });

  it("no other First Order unit — no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, PHASMA).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
