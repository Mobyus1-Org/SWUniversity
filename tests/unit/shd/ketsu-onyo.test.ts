import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SHD_147 Ketsu Onyo — When this unit deals combat damage to a base", () => {
  it("may defeat an upgrade that costs 2 or less after damaging the base", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.shd.ketsuOnyo)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.mandalorianArmor, 2), // cost 2
      ])
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0); // Ketsu attacks
    await g.chooseBaseAsync(1, 2);           // ...the enemy base

    // Trigger fires: "You may defeat an upgrade that costs 2 or less."
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0, 0);

    expect(g.state.player2.base.damage).toBe(3); // Ketsu is 3 power (cost 2, 3/2)
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("can defeat a Shield token (cost 0) on the damaged base's owner's unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.shd.ketsuOnyo)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2),
      ])
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0, 0);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("attacks past a Supercommando Squad's Sentinel (Saboteur) and can defeat one of its shields", async () => {
    // Mirrors the 'Fight for Mandalore' puzzle: Ketsu ignores Sentinel to hit the base,
    // then her base-damage trigger defeats an upgrade on the shielded Supercommando Squad.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.shd.ketsuOnyo)
      .WithGroundUnitForPlayer(2, Cards.units.shd.supercommandoSquad)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.mandalorianArmor, 2), // gives Sentinel while upgraded
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2),
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2),
      ])
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0); // Ketsu
    await g.chooseBaseAsync(1, 2);           // Saboteur lets her ignore Sentinel and hit the base
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0, 1); // defeat one Shield token

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(2); // one shield defeated
  });

  it("leaves the upgrade when the player declines the optional ability", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.shd.ketsuOnyo)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.mandalorianArmor, 2),
      ])
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
  });
});
