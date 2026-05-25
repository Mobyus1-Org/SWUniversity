import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_135 Emperor Palpatine — When Played", () => {
  it("spreads 6 damage among enemy units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);

    const enemy0 = state.player2.groundArena[0].playId;
    const enemy1 = state.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);

    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: enemy0, damage: 3 },
        { playId: enemy1, damage: 3 },
      ],
    });

    // Battlefield Marines are 3/3 — 3 damage defeats them
    expect(g.state.player2.groundArena.find(u => u.playId === enemy0)).toBeUndefined();
    expect(g.state.player2.groundArena.find(u => u.playId === enemy1)).toBeUndefined();
  });

  it("fizzles when no enemy units exist", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.units.sor.emperorPalpatine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // No spread damage prompt — Emperor enters play
    expect(g.state.player1.groundArena.some(u => u.cardId === "SOR_135")).toBe(true);
  });
});
