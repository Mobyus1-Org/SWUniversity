import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_178 Cartel Spacer — 2/3 Space (Cunning), cost 2
// "When Played: If you control another [Cunning] unit, exhaust an enemy unit that costs 4 or less."

describe("SOR_178 Cartel Spacer", () => {
  it("offers exhaust target when another Cunning unit is in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithGroundUnitForPlayer(1, Cards.units.sor.craftySmuggler) // Cunning unit
      .WithSpaceUnitForPlayer(2, Cards.units.sor.infernoFour)
      .WithCardInHandForPlayer(1, Cards.units.sor.cartelSpacer)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("exhausts the chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithGroundUnitForPlayer(1, Cards.units.sor.craftySmuggler) // Cunning unit
      .WithSpaceUnitForPlayer(2, Cards.units.sor.infernoFour)
      .WithCardInHandForPlayer(1, Cards.units.sor.cartelSpacer)
      .Build();
    g.loadNewState(state);
    state.player2.spaceArena[0].playId = "enemy-inferno";

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["enemy-inferno"] });

    expect(g.state.player2.spaceArena[0].ready).toBe(false);
  });

  it("no prompt when no other Cunning unit is in play", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.infernoFour)
      .WithCardInHandForPlayer(1, Cards.units.sor.cartelSpacer)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
