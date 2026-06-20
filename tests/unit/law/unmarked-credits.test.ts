import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("LAW_244 Unmarked Credits", () => {
  it("creates a Credit token when played", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.law.unmarkedCredits)
      .Build();
    g.loadNewState(state);

    expect(g.state.player1.supplemental.creditTokens ?? 0).toBe(0);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.supplemental.creditTokens).toBe(1);
  });

  it("accumulates Credits across multiple plays", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCreditsForPlayer(1, 2)
      .WithCardInHandForPlayer(1, Cards.events.law.unmarkedCredits)
      .Build();
    g.loadNewState(state);

    // Holding 2 Credits, playing a 1-cost card offers the discount; decline it
    // so the 2 are kept and Unmarked Credits adds a third.
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "No");

    expect(g.state.player1.supplemental.creditTokens).toBe(3);
  });
});
