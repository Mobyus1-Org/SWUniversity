import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("LAW_247 Backed by the Hutts", () => {
  it("creates a Credit token and deals damage equal to friendly Credit count", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      // Start with 3 Credits; playing Backed by the Hutts makes it 4 → 4 damage
      .WithCreditsForPlayer(1, 3)
      .WithCardInHandForPlayer(1, Cards.events.law.backedByTheHutts)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4/4 → defeated by 4
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "No");  // decline the Credit payment discount, keep all 3
    await g.chooseOptionAsync(1, "Yes"); // deal damage
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.supplemental.creditTokens).toBe(4);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("deals damage without defeating when Credit count is below target HP", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      // No prior Credits; play makes it 1 → 1 damage to a 4 HP unit
      .WithCardInHandForPlayer(1, Cards.events.law.backedByTheHutts)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.supplemental.creditTokens).toBe(1);
    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("still creates the Credit when the optional damage is skipped", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.events.law.backedByTheHutts)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "No");

    expect(g.state.player1.supplemental.creditTokens).toBe(1);
    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
