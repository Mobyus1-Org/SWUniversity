import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_001 Gar Saxon — Viceroy of Mandalore
// Leader:   "Each friendly upgraded unit gets +1/+0."
//           "Epic Action: If you control 6 or more resources, deploy this leader."
// Deployed: "Each friendly upgraded unit gets +1/+0 and gains: 'When Defeated: You may return
//            an upgrade that was attached to this unit to its owner's hand.'"
//
// Battlefield Marine SOR_095 is 3/3; Academy Training SOR_120 is a +2/+2 upgrade.

function upgradedMarine() {
  return [{ cardId: Cards.upgrades.sor.academyTraining, playId: "@", owner: 1 as const, controller: 1 as const }];
}

describe("SHD_001 Gar Saxon — leader-zone aura (+1/+0 to friendly upgraded units)", () => {
  it("gives an upgraded friendly unit +1 power from the undeployed leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.garSaxon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
        .WithUpgradesOnGroundUnitForPlayer(1, 0, upgradedMarine())     // + Academy Training (+2/+2)
        .Build(),
    );

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(6); // 3 + 2 (upgrade) + 1 (aura)
    expect(unit.TotalHP()).toBe(5);      // 3 + 2 (upgrade), aura is +1/+0
  });

  it("does NOT buff an un-upgraded friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.garSaxon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(3); // no upgrade, no aura
  });

  it("does NOT buff without Gar Saxon (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, upgradedMarine())
        .Build(),
    );

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.CurrentPower()).toBe(5); // 3 + 2, no aura
  });

  it("aura also applies from the deployed leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.garSaxon, true, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.leaders.shd.garSaxon)        // [0] deployed leader unit
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // [1] 3/3
        .WithUpgradesOnGroundUnitForPlayer(1, 1, upgradedMarine())
        .Build(),
    );

    const unit = Unit.FromInterface(g.state.player1.groundArena[1]);
    expect(unit.CurrentPower()).toBe(6); // 3 + 2 + 1
  });
});

describe("SHD_001 Gar Saxon — Epic Action deploy (6+ resources)", () => {
  it("deploys for free with 6 resources; not with 5", async () => {
    const g6 = new GameTestAdapter();
    g6.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.garSaxon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithActivePlayer(1)
        .Build(),
    );
    await g6.deployLeaderAsync(1);
    expect(g6.state.player1.leader.deployed).toBe(true);

    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.garSaxon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(false);
  });
});

describe("SHD_001 Gar Saxon — deployed grant: return an upgrade to hand when an upgraded unit is defeated", () => {
  function setup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.garSaxon, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.garSaxon)            // [0] deployed leader unit
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 4) // [1] 3/3 +2/+2 = 5 HP, 4 dmg → 1 left
      .WithUpgradesOnGroundUnitForPlayer(1, 1, upgradedMarine())
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)     // enemy 3 power kills it
      .WithActivePlayer(2);
  }

  it("returns the chosen upgrade to its owner's hand on accept", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.sor.battlefieldMarine);
    const upgradePlayId = g.state.player1.groundArena[marineIdx].upgrades[0].playId;

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, marineIdx); // enemy attacks the upgraded marine → defeats it
    await g.chooseYesAsync(1);                    // "may return an upgrade" — yes
    await g.chooseOptionAsync(1, upgradePlayId);  // pick which upgrade

    expect(g.state.player1.hand.some(c => c.cardId === Cards.upgrades.sor.academyTraining)).toBe(true);
  });

  it("declines — upgrade is not returned to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.sor.battlefieldMarine);

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, marineIdx);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.some(c => c.cardId === Cards.upgrades.sor.academyTraining)).toBe(false);
  });

  it("no grant without Gar Saxon in play (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren) // not Gar Saxon
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // 3 HP, 2 dmg → 1 left
        .WithUpgradesOnGroundUnitForPlayer(1, 0, upgradedMarine())
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(2)
        .Build(),
    );

    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.sor.battlefieldMarine);
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, marineIdx);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand.some(c => c.cardId === Cards.upgrades.sor.academyTraining)).toBe(false);
  });
});
