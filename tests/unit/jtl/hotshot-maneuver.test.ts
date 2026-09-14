import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_174 Hotshot Maneuver (Event, cost 1, Aggression)
//   "Choose a friendly unit. For each of its 'On Attack' abilities, deal 2 damage to a different
//    enemy unit. Then, attack with the chosen unit."
//
// Printed, upgrade-granted and effect-granted On Attack abilities all count. The picks are exactly
// min(abilities, enemy units), each a different unit. An exhausted unit still deals the damage but
// can't attack.

const EVENT = Cards.events.jtl.hotshotManeuver;
const FIRESPRAY = Cards.units.jtl.relentlessFirespray; // 4/6 Space — one On Attack (auto)
const AWING = Cards.units.jtl.phoenixSquadronAWing;    // 3/2 Space — no On Attack
const CONSULAR = Cards.units.lof.jediConsular;         // 1/4 Ground Force — no On Attack
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground — no On Attack
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const TURRET = Cards.upgrades.jtl.twinLaserTurret;
const up = (id: string, p: 1 | 2) => GameStateBuilder.Upgrade(id, p);

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, EVENT);
}

type TargetRes = { type: string; fromPlayIds?: string[]; fromZones?: string[]; needsMultiple?: boolean; maxTargets?: number };
const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as TargetRes;
const isAttackPrompt = (g: GameTestAdapter) => res(g)?.type === "Target" && (res(g).fromZones ?? []).includes("Base");

describe("JTL_174 Hotshot Maneuver", () => {
  it("one On Attack: 2 damage to one enemy unit, then the chosen unit attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIRESPRAY)
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    expect(res(g).needsMultiple).toBe(true);
    expect(res(g).maxTargets).toBe(1);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player2.groundArena.map(u => u.damage)).toEqual([2, 0]);

    expect(isAttackPrompt(g)).toBe(true);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("printed + upgrade On Attacks: 2 different enemy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIRESPRAY)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(TURRET, 1)])
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    expect(res(g).maxTargets).toBe(2);

    const [a, b] = g.state.player2.groundArena.map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [a, b] });

    expect(g.state.player2.groundArena.map(u => u.damage)).toEqual([2, 2, 0]);
    expect(isAttackPrompt(g)).toBe(true);
  });

  it("the picks are exact and different — too few (or the same unit twice) is rejected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIRESPRAY)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(TURRET, 1)])
      .WithGroundUnitForPlayer(2, SECURITY)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    const [a] = g.state.player2.groundArena.map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [a, a] });

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player2.groundArena.map(u => u.damage)).toEqual([0, 0]);
  });

  it("fewer enemy units than abilities: every enemy unit is hit once", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIRESPRAY)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(TURRET, 1)])
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    expect(res(g).maxTargets).toBe(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("no On Attack abilities: no damage, straight to the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, AWING).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(isAttackPrompt(g)).toBe(true);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("no enemy units: straight to the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, FIRESPRAY).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(isAttackPrompt(g)).toBe(true);
  });

  it("an exhausted chosen unit deals the damage but doesn't attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIRESPRAY, false)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("a conditional grant counts only when active: Jedi Lightsaber on a Force unit vs a non-Force unit", async () => {
    const force = new GameTestAdapter();
    force.loadNewState(base()
      .WithGroundUnitForPlayer(1, CONSULAR)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(Cards.upgrades.sor.jediLightsaber, 1)])
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());
    await force.playCardFromHandAsync(1, 0);
    await force.chooseGroundUnitAsync(1, 0);
    expect(res(force).maxTargets).toBe(1);

    const plain = new GameTestAdapter();
    plain.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(Cards.upgrades.sor.jediLightsaber, 1)])
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());
    await plain.playCardFromHandAsync(1, 0);
    await plain.chooseGroundUnitAsync(1, 0);
    expect(isAttackPrompt(plain)).toBe(true);
  });

  it("offers only friendly units, exhausted ones included; with none, nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, AWING, false)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());
    await g.playCardFromHandAsync(1, 0);
    expect(res(g).fromPlayIds).toEqual([g.state.player1.spaceArena[0].playId]);

    const none = new GameTestAdapter();
    none.loadNewState(base().WithGroundUnitForPlayer(2, SECURITY).Build());
    await none.playCardFromHandAsync(1, 0);
    expect(none.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
