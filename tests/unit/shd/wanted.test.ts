import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_221 Wanted (Upgrade, cost 0, Cunning, Bounty/Condition)
// "Attached unit gains: 'Bounty — Ready 2 friendly resources.'
//  (When this unit is defeated or captured, its opponent collects its bounty.)"
//
// "friendly" is relative to the collector — the opponent of the attached unit's controller.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
}

/** Exhausts every resource of `player` so readying is observable. */
function exhaustAll(g: GameTestAdapter, player: 1 | 2) {
  for (const r of (player === 1 ? g.state.player1 : g.state.player2).resources) r.ready = false;
}

describe("SHD_221 Wanted", () => {
  it("readies 2 of the collector's resources when the bounty is collected on defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.shd.wanted, 1)])
        .Build(),
    );
    exhaustAll(g, 1);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // Wampa (5 power) kills the Marine (3 HP)
    await g.chooseYesAsync(1);

    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(2);
  });

  it("readies nothing when the bounty is declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.shd.wanted, 1)])
        .Build(),
    );
    exhaustAll(g, 1);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(0);
  });

  it("readies only what is available when the collector has 1 exhausted resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.shd.wanted, 1)])
        .Build(),
    );
    for (const r of g.state.player1.resources) r.ready = true;
    g.state.player1.resources[0].ready = false;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(5);
  });

  it("readies the COLLECTOR's resources, not the defeated unit's controller's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 5)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.shd.wanted, 1)])
        .Build(),
    );
    exhaustAll(g, 1);
    exhaustAll(g, 2);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(2);
    expect(g.state.player2.resources.filter(r => r.ready)).toHaveLength(0);
  });

  it("collects the bounty when the attached unit is captured", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.shd.wanted, 1)])
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // captor
    await g.chooseGroundUnitAsync(2, 0); // captive
    exhaustAll(g, 1); // only the bounty's readying should show up below
    await g.chooseYesAsync(1);

    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(2);
  });

  it("does not prompt when the defeated unit has no Wanted attached (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );
    exhaustAll(g, 1);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(0);
  });
});
