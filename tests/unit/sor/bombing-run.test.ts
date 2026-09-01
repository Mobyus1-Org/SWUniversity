import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_173 Bombing Run", () => {
  // Regression: the damage was applied as a raw `unit.damage += 3`, which skipped Shield
  // absorption, damage prevention and the when-unit-takes-damage trigger, and never swept the
  // units it killed. It now goes through DealDamageToUnit like every other damage source.
  function shieldedBoard() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.bombingRun);
  }

  it("a Shield absorbs it rather than the unit taking damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      shieldedBoard()
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.token.shield, playId: "@", owner: 2, controller: 2 },
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // Ground

    const defender = g.state.player2.groundArena[0];
    expect(defender.damage).toBe(0);
    expect(defender.upgrades).toHaveLength(0); // the Shield was spent
  });

  it("defeats the units it finishes off", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      shieldedBoard()
        .WithGroundUnitForPlayer(1, Cards.units.twi.phaseIClonetrooper) // 3/2 — lethal
        .WithGroundUnitForPlayer(2, Cards.units.twi.phaseIClonetrooper)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("a Shield absorbs the SPACE half too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      shieldedBoard()
        .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.token.shield, playId: "@", owner: 2, controller: 2 },
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // Space

    const defender = g.state.player2.spaceArena[0];
    expect(defender.damage).toBe(0);
    expect(defender.upgrades).toHaveLength(0);
  });

  it("Yes (ground): deals 3 damage to each ground unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren) // Aggression covers SOR_173's Aggression
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.bombingRun)
      .WithGroundUnitForPlayer(1, Cards.units.sor.emperorPalpatine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // Ground arena

    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player2.spaceArena[0].damage).toBe(0); // Space untouched
  });

  it("No (space): deals 3 damage to each space unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.events.sor.bombingRun)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // Space arena

    expect(g.state.player1.spaceArena[0].damage).toBe(3);
    expect(g.state.player2.spaceArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena[0].damage).toBe(0); // Ground untouched
  });
});
