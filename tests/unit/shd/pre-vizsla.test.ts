import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_142 Pre Vizsla — Power Hungry (Unit 8/7 Ground, cost 7, Villainy/Aggression)
//   "When Played/On Attack: You may pay the cost of an upgrade attached to another non-Vehicle
//    unit. If you do, take control of that upgrade and attach it to this unit, if able. If it
//    can't attach to this unit, defeat it instead."
//
// Only upgrades you can afford are offered. A token has no cost, so it's free.

const PRE = Cards.units.shd.preVizsla;
const MARINE = Cards.units.sor.battlefieldMarine;
const TIE = Cards.units.sor.tieLnFighter;              // Vehicle
const FORCE_UNIT = Cards.units.sor.guardianOfTheWhills; // Force
const TRAINING = Cards.upgrades.sor.academyTraining;   // cost 2, +2/+2
const SABER = Cards.upgrades.lof.inquisitorsLightsaber; // cost 2
const COMPARTMENT = Cards.upgrades.sor.smugglingCompartment; // cost 1, Vehicle only
const ENDURANCE = Cards.upgrades.lof.bolsteredEndurance;  // cost 1, Force units only
const SHIELD = Cards.upgrades.token.shield;

const up = (cardId: string, controller: 1 | 2) => GameStateBuilder.Upgrade(cardId, controller);
const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const pre = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === PRE)!;
const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds ?? [];

function base(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Aggression/Villainy — no penalty on Pre
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

describe("SHD_142 Pre Vizsla — When Played", () => {
  it("pays the upgrade's cost, takes control of it, and attaches it to Pre", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(9)
        .WithCardInHandForPlayer(1, PRE)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(TRAINING, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(pre(g).upgrades.map(u => u.cardId)).toEqual([TRAINING]);
    expect(pre(g).upgrades[0].controller).toBe(1);
    expect(ready(g)).toBe(0); // 7 for Pre + 2 for the upgrade
  });

  it("offers upgrades on other NON-VEHICLE units, either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(20)
        .WithCardInHandForPlayer(1, PRE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(TRAINING, 1)])
        .WithSpaceUnitForPlayer(2, TIE)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [up(COMPARTMENT, 2)])
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(SABER, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect([...offer(g)].sort()).toEqual([
      g.state.player1.groundArena[0].upgrades[0].playId,
      g.state.player2.groundArena[0].upgrades[0].playId,
    ].sort());
  });

  it("leaves out upgrades you can't afford — a token costs nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(8) // 1 left after paying 7 for Pre
        .WithCardInHandForPlayer(1, PRE)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(TRAINING, 2), up(SHIELD, 2)])
        .WithGroundUnitForPlayer(2, FORCE_UNIT)
        .WithUpgradesOnGroundUnitForPlayer(2, 1, [up(ENDURANCE, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    const shield = g.state.player2.groundArena[0].upgrades.find(u => u.cardId === SHIELD)!.playId;
    const endurance = g.state.player2.groundArena[1].upgrades[0].playId;
    expect([...offer(g)].sort()).toEqual([shield, endurance].sort());
  });

  it("a Shield token is taken for free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(7)
        .WithCardInHandForPlayer(1, PRE)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(SHIELD, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(pre(g).upgrades.map(u => u.cardId)).toEqual([SHIELD]);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("an upgrade that can't attach to Pre is paid for, then defeated to its owner's discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(8)
        .WithCardInHandForPlayer(1, PRE)
        .WithGroundUnitForPlayer(2, FORCE_UNIT)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(ENDURANCE, 2)]) // Force units only; Pre isn't one
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(pre(g).upgrades).toHaveLength(0);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.discard.some(c => c.cardId === ENDURANCE)).toBe(true);
    expect(ready(g)).toBe(0); // the cost was still paid
  });

  it("declining pays nothing and moves nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(9)
        .WithCardInHandForPlayer(1, PRE)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(TRAINING, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
    expect(ready(g)).toBe(2);
  });

  it("no offer when there is no upgrade on another non-Vehicle unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(9).WithCardInHandForPlayer(1, PRE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});

describe("SHD_142 Pre Vizsla — On Attack", () => {
  it("does the same on attack, before damage — and never offers Pre's own upgrades", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(5)
        .WithGroundUnitForPlayer(1, PRE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SABER, 1)])
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(TRAINING, 2)])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    expect(offer(g)).toEqual([g.state.player2.groundArena[0].upgrades[0].playId]);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(pre(g).upgrades.map(u => u.cardId).sort()).toEqual([SABER, TRAINING].sort());
    expect(g.state.player2.base.damage).toBe(8 + 1 + 2); // Pre + Lightsaber + Training
    expect(ready(g)).toBe(3);
  });
});
