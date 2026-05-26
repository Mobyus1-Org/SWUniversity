import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_016 Grand Admiral Thrawn — Leader Ability", () => {
  function buildBase() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine);
  }

  it("exhausts 1 resource when using the ability", async () => {
    const g = new GameTestAdapter();
    const state = buildBase().Build();
    g.loadNewState(state);

    const resourcesBefore = g.state.player1.resources.filter(r => r.ready).length;
    await g.useLeaderAbilityAsync(1);

    const resourcesAfter = g.state.player1.resources.filter(r => r.ready).length;
    expect(resourcesAfter).toBe(resourcesBefore - 1);
  });

  it("exhausts the leader after using the ability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildBase().Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("is rejected when no ready resources remain", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);

    // Leader should still be ready — ability was rejected
    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("reveals the top card of own deck and prompts target selection", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildBase().Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });
});
