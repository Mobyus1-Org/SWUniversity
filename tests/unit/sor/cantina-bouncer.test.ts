import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_202 Cantina Bouncer", () => {
  it("When Played: returns a non-leader unit to its owner's hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP) // Cunning base
      .MyLeader(Cards.leaders.sor.hanSolo) // Cunning+Heroism — two Cunning sources for SOR_202's Cunning,Cunning
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.cantinaBouncer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });

  it("When Played: player may skip the bounce", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.hanSolo)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.cantinaBouncer)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});
