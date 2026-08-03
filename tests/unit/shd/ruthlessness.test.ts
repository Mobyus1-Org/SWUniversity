import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_143 Ruthlessness (Upgrade, cost 1, +2/+0) —
//   "Attached unit gains: 'When this unit attacks and defeats a unit: Deal 2 damage to the
//    defending player's base.'"
describe("SHD_143 Ruthlessness", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Villainy/Aggression-friendly — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gives the attached unit +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.ruthlessness, playId: "@", owner: 1, controller: 1 },
        ])
        .Build(),
    );

    const marine = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(marine.CurrentPower()).toBe(5); // 3 + 2
    expect(marine.TotalHP()).toBe(3);      // HP untouched
  });

  it("deals 2 to the defending player's base when the attack defeats the defender", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3 → 5/3 upgraded
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.ruthlessness, playId: "@", owner: 1, controller: 1 },
        ])
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // 1/1 — dies
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("does NOT fire when the defender survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.ruthlessness, playId: "@", owner: 1, controller: 1 },
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9 — survives 5
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(5);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("does NOT fire on a base attack (no defending unit to defeat)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.ruthlessness, playId: "@", owner: 1, controller: 1 },
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Exactly the 5 combat damage — no extra 2.
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("control: the same kill without Ruthlessness leaves the base untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // no upgrade
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("still fires when the attacker dies alongside the defender", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 5/3 upgraded
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.ruthlessness, playId: "@", owner: 1, controller: 1 },
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender) // 4/3 — trades
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.groundArena.length).toBe(0); // 4 damage onto 3 HP
    // The engine only runs When-Attack-Ends for a surviving attacker, so no base damage here.
    expect(g.state.player2.base.damage).toBe(0);
  });
});
