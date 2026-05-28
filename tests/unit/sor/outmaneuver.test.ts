import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_221 Outmaneuver", () => {
  it("Yes (ground): exhausts each ground unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo) // Cunning+Heroism covers SOR_221's Cunning
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.outmaneuver)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // starts ready (default)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // starts ready (default)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)  // starts ready (default)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // Ground

    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.state.player2.spaceArena[0].ready).toBe(true); // Space untouched
  });

  it("No (space): exhausts each space unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.outmaneuver)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // starts ready
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)  // starts ready
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)  // starts ready
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // Space

    expect(g.state.player1.spaceArena[0].ready).toBe(false);
    expect(g.state.player2.spaceArena[0].ready).toBe(false);
    expect(g.state.player1.groundArena[0].ready).toBe(true); // Ground untouched
  });
});
