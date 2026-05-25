import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_077 Takedown", () => {
  it("defeats a unit with 5 or less remaining HP", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 — 3 HP ≤ 5
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6) // cost 4 + 2 aspect penalty for Vigilance
      .WithCardInHandForPlayer(1, Cards.events.sor.takedown)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // target player 2's unit at index 0

    expect(g.state.player2.groundArena.find(u => u.playId === marinePlayId)).toBeUndefined();
  });

  it("does not offer units with more than 5 HP as targets", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine) // SOR_135 — 6 HP > 5
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6) // cost 4 + 2 aspect penalty for Vigilance
      .WithCardInHandForPlayer(1, Cards.events.sor.takedown)
      .Build();
    g.loadNewState(state);

    // No eligible targets → fizzles
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(0); // card was played
    expect(g.state.player2.groundArena).toHaveLength(1); // emperorPalpatine still alive
  });
});
