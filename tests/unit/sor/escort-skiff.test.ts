import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// SOR_114 Escort Skiff (Command) — "While you control another Command unit, this unit gains Ambush."
describe("SOR_114 Escort Skiff — conditional Ambush", () => {
  it("gains Ambush while controlling another Command unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.escortSkiff)
      .WithGroundUnitForPlayer(1, Cards.units.sor.allianceDispatcher) // Command unit
      .Build();
    g.loadNewState(state);

    const skiff = g.state.player1.groundArena[0];
    expect(HasAmbush(skiff.cardId, skiff.playId, undefined, 1)).toBe(true);
  });

  it("does NOT gain Ambush when the only other unit is Cunning (not Command)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.escortSkiff)
      .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards) // Cunning unit
      .Build();
    g.loadNewState(state);

    const skiff = g.state.player1.groundArena[0];
    expect(HasAmbush(skiff.cardId, skiff.playId, undefined, 1)).toBe(false);
  });
});
