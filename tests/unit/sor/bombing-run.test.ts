import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_173 Bombing Run", () => {
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
