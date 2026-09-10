import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// TWI_034 General Grievous — Trophy Collector. Cost 3, 4/4 Ground Separatist/Official, unique.
//   "Ignore the aspect penalty on each Lightsaber upgrade you play on this unit.
//    On Attack: If this unit has 4 or more Lightsaber upgrades attached to him, defeat 4 enemy
//    units."
//
// The waiver is host-specific — it applies only when the Lightsaber goes on HIM — so the engine
// defers the upgrade's payment until the host is chosen.

const GRIEVOUS = Cards.units.twi.generalGrievousTrophyCollector;
const SABER = Cards.upgrades.lof.inquisitorsLightsaber; // a Lightsaber-trait upgrade
const NON_SABER = Cards.upgrades.sor.academyTraining;
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const sabers = (n: number) =>
  Array.from({ length: n }, () => GameStateBuilder.Upgrade(SABER, 1));

describe("TWI_034 General Grievous — Trophy Collector (On Attack)", () => {
  it("defeats the chosen enemy units when he carries 4 Lightsabers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, GRIEVOUS)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, sabers(4))
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );
    const victims = g.state.player2.groundArena.map(u => u.playId);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: victims });

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("does nothing with only 3 Lightsabers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, GRIEVOUS)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, sabers(3))
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("counts LIGHTSABERS specifically, not upgrades in general", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, GRIEVOUS)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          ...sabers(3),
          GameStateBuilder.Upgrade(NON_SABER, 1), // 4 upgrades, only 3 Lightsabers
        ])
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("offers only ENEMY units, capped at 4", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, GRIEVOUS)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, sabers(4))
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[]; maxTargets?: number };
    expect(res.fromPlayIds).toEqual([g.state.player2.groundArena[0].playId]);
    expect(res.maxTargets).toBe(4);
  });
});

describe("TWI_034 General Grievous — defeat exactly 4", () => {
  function fiveEnemies() {
    const b = base()
      .WithGroundUnitForPlayer(1, GRIEVOUS)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, sabers(4));
    for (let i = 0; i < 5; i++) b.WithGroundUnitForPlayer(2, MARINE);
    return b;
  }

  it("rejects picking fewer than 4 when 4 or more enemies exist — nothing is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(fiveEnemies().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const three = g.state.player2.groundArena.slice(0, 3).map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: three });

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player2.groundArena).toHaveLength(5);
  });

  it("choosing nothing is not allowed either", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(fiveEnemies().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player2.groundArena).toHaveLength(5);
  });

  it("defeats exactly the 4 chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(fiveEnemies().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const four = g.state.player2.groundArena.slice(0, 4).map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: four });

    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});

describe("TWI_034 General Grievous — Lightsaber aspect penalty waiver", () => {
  // Fallen Lightsaber: cost 3, Aggression/Villainy. With a Command/Heroism leader and a Vigilance
  // base both icons are uncovered: 3 + 4 = 7 normally, 3 when played on Grievous.
  const FALLEN = Cards.upgrades.sor.fallenLightsaber;

  function waiverSetup(resources: number) {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, MARINE, resources)
      .WithGroundUnitForPlayer(1, GRIEVOUS)
      .WithGroundUnitForPlayer(1, MARINE);
  }

  const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

  it("a Lightsaber played ON Grievous ignores its aspect penalty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(waiverSetup(10).WithCardInHandForPlayer(1, FALLEN).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // Grievous

    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toEqual([FALLEN]);
    expect(10 - ready(g)).toBe(3);
  });

  it("control: the same Lightsaber on another unit pays the penalty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(waiverSetup(10).WithCardInHandForPlayer(1, FALLEN).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1); // the Marine

    expect(g.state.player1.groundArena[1].upgrades.map(u => u.cardId)).toEqual([FALLEN]);
    expect(10 - ready(g)).toBe(7);
  });

  it("affordable only at the waived price → playable, and only Grievous is offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(waiverSetup(3).WithCardInHandForPlayer(1, FALLEN).Build());

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player1.groundArena[0].playId]);
    await g.chooseGroundUnitAsync(1, 0);
    expect(ready(g)).toBe(0);
  });

  it("a NON-Lightsaber upgrade on Grievous still pays its penalty", async () => {
    const g = new GameTestAdapter();
    // Vambrace Flamethrower (cost 3, Aggression) is not a Lightsaber: 3 + 2 for the uncovered icon.
    const upgrade = Cards.upgrades.shd.vambraceFlamethrower;
    g.loadNewState(waiverSetup(10).WithCardInHandForPlayer(1, upgrade).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(10 - ready(g)).toBe(5);
  });

  it("an ENEMY Grievous gives you no waiver — 'you play on this unit' is his controller", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, MARINE, 10)
        .WithGroundUnitForPlayer(2, GRIEVOUS)
        .WithCardInHandForPlayer(1, FALLEN)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(10 - ready(g)).toBe(7);
  });
});
