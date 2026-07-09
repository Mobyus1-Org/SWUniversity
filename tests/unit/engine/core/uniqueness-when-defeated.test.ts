import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

// When a unique unit is defeated by the uniqueness rule (a duplicate copy entering
// play forces the controller to defeat one), its "When Defeated" ability must still fire.
// Admiral Motti (SOR_226, unique) — "When Defeated: You may ready a [Villainy] unit."

describe("uniqueness rule — defeated copy still fires When Defeated", () => {
  it("Admiral Motti defeated by the uniqueness rule prompts its When Defeated ability", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.admiralMotti)
      .WithCardInHandForPlayer(1, Cards.units.sor.admiralMotti)
      .FillResourcesForPlayer(1, Cards.units.sor.superlaserTechnician, 3)
      .WithActivePlayer(1)
      .Build();
    g.loadNewState(state);

    // Play the second Admiral Motti — uniqueness rule prompts which copy to defeat.
    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    // Choose to defeat the original copy.
    await g.chooseGroundUnitAsync(1, 0);

    // Motti's "When Defeated: ready a [Villainy] unit" must now be offered.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });
});
