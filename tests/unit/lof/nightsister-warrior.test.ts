import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_059 Nightsister Warrior (2/2 Ground) — "When Defeated: Draw a card."
function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine);
}

describe("LOF_059 Nightsister Warrior", () => {
  it("draws a card when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.nightsisterWarrior)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // 4 power kills the 2/2
        .Build(),
    );
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // Warrior dies to the 4-power counter-attack

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.length).toBe(handBefore + 1);
  });
});
