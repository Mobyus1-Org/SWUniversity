import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { CardIsPlayable } from "@/server/engine/card-playability";
import { Cards } from "../../card-helpers";

// Exercises the Credit consumption / {1R} discount payment flow.
// battlefieldMarine costs 2, gamorreanGuards costs 4.

function readyCount(resources: { ready: boolean }[]): number {
  return resources.filter(r => r.ready).length;
}

describe("Credit payment discount", () => {
  it("does not prompt when the player controls no Credits", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    // Plays straight through with no option prompt; pays full cost of 2.
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(readyCount(g.state.player1.resources)).toBe(3); // 5 - 2
  });

  it("single-Credit case auto-spends 1 on Yes (Use 1 Credit?)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCreditsForPlayer(1, 1)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");

    expect(g.state.player1.supplemental.creditTokens).toBe(0);
    expect(readyCount(g.state.player1.resources)).toBe(4); // 5 - (2-1)
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("declining (No) pays full cost and keeps Credits", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCreditsForPlayer(1, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "No");

    expect(g.state.player1.supplemental.creditTokens).toBe(2);
    expect(readyCount(g.state.player1.resources)).toBe(3); // 5 - 2
  });

  it("multi-Credit case lets the player choose how many to defeat", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCreditsForPlayer(1, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 (on-aspect)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes"); // Use Credits?
    await g.chooseOptionAsync(1, "2");   // defeat 2 of up to 2 useful

    expect(g.state.player1.supplemental.creditTokens).toBe(1); // 3 - 2
    expect(readyCount(g.state.player1.resources)).toBe(5); // 5 - (2-2)
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("Credits fully cover the cost with no prompt when resources are exhausted", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 0) // no resources
      .WithCreditsForPlayer(1, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 (on-aspect)
      .Build();
    g.loadNewState(state);

    // maxUseful (2) === minForced (2): no choice to make, so no prompt is raised.
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.supplemental.creditTokens).toBe(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("counts Credits toward affordability", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCreditsForPlayer(1, 1)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .Build();
    g.loadNewState(state);

    // 1 resource alone cannot pay 2 — but 1 resource + 1 Credit can.
    expect(CardIsPlayable(g.state, 1, Cards.units.sor.battlefieldMarine)).toBe(true);
  });

  it("force-spends Credits with no prompt when resources alone cannot pay", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCreditsForPlayer(1, 1)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .Build();
    g.loadNewState(state);

    // maxUseful (1) === minForced (1): no choice, so it just plays.
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.supplemental.creditTokens).toBe(0);
    expect(readyCount(g.state.player1.resources)).toBe(0); // 1 - (2-1)
  });

  it("prompts with a floor when the spend is only partly forced", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCreditsForPlayer(1, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .Build();
    g.loadNewState(state);

    // ready 1, cost 2 → minForced 1; credits 2 → maxUseful 2. The choice is 1 or 2.
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes"); // only one amount above the floor → auto-spends 2

    expect(g.state.player1.supplemental.creditTokens).toBe(0);
    expect(readyCount(g.state.player1.resources)).toBe(1); // 1 - (2-2)
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("pays a leader's action ability cost with Credits", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Action [1 resource, exhaust]
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCreditsForPlayer(1, 1)
      .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper) // an Imperial unit to target
      .Build();
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);
    await g.chooseOptionAsync(1, "Yes"); // one useful Credit → auto-spends it

    expect(g.state.player1.supplemental.creditTokens).toBe(0);
    expect(readyCount(g.state.player1.resources)).toBe(2); // the Credit covered the whole cost
  });

  // No leader-deploy Credit test: deploying a leader is an Epic Action gated on
  // *controlling* N resources ("If you control 6 or more resources, deploy this
  // leader") — it never exhausts any, so there is no payment for Credits to reduce.

  it("pays a Smuggle cost with Credits", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, Cards.units.shd.warbirdStowaway, 1) // Smuggle 4
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 4)
      .WithCreditsForPlayer(1, 1)
      .WithCardInDeckForPlayer(1, Cards.bases.common.red30HP)
      .Build();
    g.loadNewState(state);

    // Smuggling the ready resource itself pays 1 less, so the cost here is 3.
    await g.smuggleResourceAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes"); // one useful Credit → auto-spends it

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.supplemental.creditTokens).toBe(0);
    expect(readyCount(g.state.player1.resources)).toBe(2); // 4 remaining - (3 - 1)
  });

  it("pays Clandestine Connections' mid-resolution cost with Credits", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCreditsForPlayer(1, 5)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.upgrades.sec.clandestineConnections, playId: "@", owner: 1, controller: 1 },
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "Yes"); // SEC_264: pay 2 to deal 2 to a base
    // Resources could cover the 2, so the Credit spend is a real choice this time.
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseOptionAsync(1, "2");
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"] });

    expect(g.state.player1.supplemental.creditTokens).toBe(3); // 5 - 2
    expect(readyCount(g.state.player1.resources)).toBe(3); // Credits covered it entirely
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("rolls back the speculative run while the Credit prompt is open", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithCreditsForPlayer(1, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // Prompt is open: nothing has happened yet. The card is still in hand, no
    // resources are exhausted, no Credits are gone, no unit has entered play.
    expect(g.state.player1.hand).toHaveLength(1);
    expect(readyCount(g.state.player1.resources)).toBe(5);
    expect(g.state.player1.supplemental.creditTokens).toBe(2);
    expect(g.state.player1.groundArena).toHaveLength(0);

    await g.chooseOptionAsync(1, "Yes");
    await g.chooseOptionAsync(1, "2");

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.supplemental.creditTokens).toBe(0);
    expect(readyCount(g.state.player1.resources)).toBe(5); // 5 - (2-2)
  });
});
