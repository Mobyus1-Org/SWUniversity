import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_017 Lando Calrissian (With Impeccable Taste) — 2/5 Ground leader, cost 4.
// FRONT:    Action [Exhaust]: Play a card using Smuggle. It costs 2 resources less.
//           Defeat a resource you own and control.
// DEPLOYED: Action: same, plus "Use this ability only once each round."
//
// Resources are Collections Starhopper (SHD_111): Smuggle [3, Command], no other ability.
// The base is Command, so no aspect penalty — the discounted Smuggle cost is 1.

function frontState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.shd.landoCalrissian)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.shd.collectionsStarhopper, 10)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithActivePlayer(1);
}

/** Chooses player 1's resource at `index` as a target. */
async function chooseResource(g: GameTestAdapter, index: number) {
  return g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.resources[index].playId] });
}

describe("SHD_017 Lando Calrissian — leader (front) ability", () => {
  it("plays a resource using Smuggle, then defeats a resource you own", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().Build());

    const resourcesBefore = g.state.player1.resources.length;
    const deckBefore = g.state.player1.deck.length;

    await g.useLeaderAbilityAsync(1);
    await chooseResource(g, 0); // which resource to Smuggle

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.shd.collectionsStarhopper)).toBe(true);
    expect(g.state.player1.deck).toHaveLength(deckBefore - 1); // replaced from the top of the deck

    // Then "Defeat a resource you own and control."
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await chooseResource(g, 0);

    // -1 smuggled, +1 replacement, -1 defeated.
    expect(g.state.player1.resources).toHaveLength(resourcesBefore - 1);
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust
  });

  it("costs 2 resources less than the printed Smuggle cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().Build());

    // Only 1 ready resource: the full Smuggle cost of 3 is unaffordable, but 3-2=1 is not.
    const state = g.state;
    state.player1.resources.forEach((r, i) => { r.ready = i === 0; });

    await g.useLeaderAbilityAsync(1);
    await chooseResource(g, 0);

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.shd.collectionsStarhopper)).toBe(true);
  });

  it("the defeated resource must be one you own and control", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().FillResourcesForPlayer(2, Cards.units.shd.collectionsStarhopper, 5).Build());

    await g.useLeaderAbilityAsync(1);
    await chooseResource(g, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds ?? [];
    const p2PlayIds = g.state.player2.resources.map(r => r.playId);
    expect(targets.some(t => p2PlayIds.includes(t))).toBe(false);
    expect(targets.length).toBeGreaterThan(0);
  });

  it("is not offered when no resource can be Smuggled", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.landoCalrissian)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        // Battlefield Marine has no Smuggle cost at all.
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("SHD_017 Lando Calrissian — deployed leader unit", () => {
  function deployedState() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.landoCalrissian, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.shd.collectionsStarhopper, 10)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.landoCalrissian)
      .WithActivePlayer(1);
  }

  it("the deployed Action plays a Smuggle card and defeats a resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    const resourcesBefore = g.state.player1.resources.length;
    await g.dispatchAsync(1, "use-ability", { playId: g.state.player1.groundArena[0].playId });
    await chooseResource(g, 0);
    await chooseResource(g, 0);

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.shd.collectionsStarhopper)).toBe(true);
    expect(g.state.player1.resources).toHaveLength(resourcesBefore - 1);
  });

  it("does NOT exhaust the deployed leader (the Action has no exhaust cost)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    await g.dispatchAsync(1, "use-ability", { playId: g.state.player1.groundArena[0].playId });
    await chooseResource(g, 0);
    await chooseResource(g, 0);

    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("can only be used once each round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());
    const landoPlayId = g.state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { playId: landoPlayId });
    await chooseResource(g, 0);
    await chooseResource(g, 0);
    const afterFirst = g.state.player1.resources.length;

    // Second attempt in the same round does nothing.
    await g.dispatchAsync(2, "pass-action", {});
    const result = await g.dispatchAsync(1, "use-ability", { playId: landoPlayId });

    expect(result.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.resources).toHaveLength(afterFirst);
  });
});
