import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";
import type { Unit as UnitInterface } from "@/lib/engine/core-models";

// SEC_244 Darth Nihilus - Lord of Hunger (6/6 Ground, cost 7, Villainy, Force/Sith) —
//   "When Played/On Attack: Deal 3 damage to the unit with the least remaining HP among other
//    units. (If multiple units are tied, choose one.) If it's a non-Vehicle unit, give an
//    Experience token to this unit."

const xpCount = (u: UnitInterface) =>
  u.upgrades.filter(up => up.cardId === Cards.upgrades.token.experience).length;

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.sec.darthNihilus);
}

const nihilus = (g: GameTestAdapter) =>
  g.state.player1.groundArena.find(u => u.cardId === Cards.units.sec.darthNihilus)!;

describe("SEC_244 Darth Nihilus — When Played", () => {
  it("offers only the unit with the least remaining HP and deals it 3 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 — the lowest
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(target.fromPlayIds!.length).toBe(1); // only the 3-HP Marine

    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(1); // the Marine died to 3 damage
    expect(g.state.player2.groundArena[0].cardId).toBe(Cards.units.sor.consularSecurityForce);
  });

  it("gives Nihilus an Experience token when the damaged unit is non-Vehicle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 non-Vehicle
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(xpCount(nihilus(g))).toBe(1);
  });

  it("gives NO Experience token when the damaged unit is a Vehicle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter) // 2/1 Vehicle — the lowest HP
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena.length).toBe(0); // the TIE died to 3 damage
    expect(xpCount(nihilus(g))).toBe(0); // but it was a Vehicle — no token
  });

  it("still grants the Experience token when the damaged non-Vehicle unit dies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 — dies to 3 damage
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(xpCount(nihilus(g))).toBe(1);
  });

  it("offers both tied units when the minimum remaining HP is shared", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 HP
        .WithGroundUnitForPlayer(1, Cards.units.sec.sithAssassin, true, 1) // 2 HP - 1 damage = 1
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true, 6) // 7 - 6 = 1
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(target.fromPlayIds!.length).toBe(2); // both units at 1 remaining HP
  });

  it("can hit a FRIENDLY unit — 'other units', not 'enemy units'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sec.sithAssassin) // 3/2 friendly — the lowest HP
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    const assassinPlayId = g.state.player1.groundArena
      .find(u => u.cardId === Cards.units.sec.sithAssassin)!.playId;
    expect(target.fromPlayIds).toContain(assassinPlayId);
  });

  it("never targets itself — 'among OTHER units'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true, 6) // 1 remaining HP
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(target.fromPlayIds).not.toContain(nihilus(g).playId);
  });

  it("does nothing when Nihilus is the only unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(xpCount(nihilus(g))).toBe(0);
  });
});

describe("SEC_244 Darth Nihilus — On Attack", () => {
  it("fires the same ability when he attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sec.darthNihilus)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — the only other unit
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack target
    await g.chooseGroundUnitAsync(2, 0); // On Attack: the only eligible unit

    // 3 from the ability + 6 from combat = 9 on a 7-HP unit → defeated.
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(xpCount(nihilus(g))).toBe(1);
  });
});
