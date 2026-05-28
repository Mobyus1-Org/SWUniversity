import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_240 Fleet Lieutenant", () => {
  it("When Played: attacks with a Rebel unit and it gets +2/+0", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren) // Heroism covers SOR_240's Heroism aspect
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.fleetLieutenant)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel, 3 power
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);

    const rebelPlayId = state.player1.groundArena[0].playId;
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [rebelPlayId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    // Rebel marine (3 + 2 = 5) deals 5 damage
    expect(g.state.player2.groundArena[0].damage).toBe(5);
  });

  it("When Played: attacking with a non-Rebel unit gives no bonus", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.fleetLieutenant)
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper) // not Rebel, 3 power
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);

    const nonRebelPlayId = state.player1.groundArena[0].playId;
    const defenderPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [nonRebelPlayId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderPlayId] });

    // Death Trooper (3 power, no buff) deals 3 damage
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("When Played: player may skip the attack", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.fleetLieutenant)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
