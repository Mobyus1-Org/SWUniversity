import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// SHD_009 Hunter (Outcast Sergeant) — 5/8 Ground leader, cost 7.
// FRONT:    Action [1 resource, Exhaust]: Reveal a resource you control. If it shares a name with a
//           friendly unique unit, return the resource to its owner's hand and put the top card of
//           your deck into play as a resource.
// DEPLOYED: Overwhelm
//           On Attack: You may reveal a resource you control. [same effect]
//
// Fixtures use Luke Skywalker (SOR_051, unique) as both the resource name and the friendly unit.

function frontState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.shd.hunter)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.lukeSkywalker, 8) // every resource is "Luke Skywalker"
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithActivePlayer(1);
}

/** Reveals player 1's resource at `index`. */
async function revealResource(g: GameTestAdapter, index: number) {
  const playId = g.state.player1.resources[index].playId;
  return g.dispatchAsync(1, "choose-target", { targetPlayIds: [playId] });
}

describe("SHD_009 Hunter — leader (front) ability", () => {
  it("returns the matching resource to hand and resources the top card of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker).Build());

    const resourcesBefore = g.state.player1.resources.length;
    await g.useLeaderAbilityAsync(1);
    await revealResource(g, 0);

    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.lukeSkywalker);
    // One resource left for the hand, one arrived from the deck — the count is unchanged.
    expect(g.state.player1.resources).toHaveLength(resourcesBefore);
    expect(g.state.player1.resources.some(r => r.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("the resource put into play from the deck enters exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker).Build());

    await g.useLeaderAbilityAsync(1);
    await revealResource(g, 0);

    const fromDeck = g.state.player1.resources.find(r => r.cardId === Cards.units.sor.battlefieldMarine);
    expect(fromDeck?.ready).toBe(false);
  });

  it("does nothing when the revealed resource matches no friendly unique unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    const resourcesBefore = g.state.player1.resources.length;
    await g.useLeaderAbilityAsync(1);
    await revealResource(g, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.resources).toHaveLength(resourcesBefore);
    expect(g.state.player1.deck).toHaveLength(1); // untouched
    expect(g.state.player1.leader.ready).toBe(false); // the cost was still paid
  });

  it("a NON-unique friendly unit with the same name does not count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.hunter)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8) // non-unique name
        .WithCardInDeckForPlayer(1, Cards.units.sor.gamorreanGuards)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await revealResource(g, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(1);
  });

  it("an ENEMY unique unit with the same name does not count ('friendly')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithGroundUnitForPlayer(2, Cards.units.sor.lukeSkywalker).Build());

    await g.useLeaderAbilityAsync(1);
    await revealResource(g, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(1);
  });

  it("with an empty deck, the resource still returns to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.hunter)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.lukeSkywalker, 8)
        .WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker)
        .WithActivePlayer(1)
        .Build(),
    );

    const resourcesBefore = g.state.player1.resources.length;
    await g.useLeaderAbilityAsync(1);
    await revealResource(g, 0);

    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.lukeSkywalker);
    expect(g.state.player1.resources).toHaveLength(resourcesBefore - 1);
  });

  it("is not offered when you control no resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.hunter)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("SHD_009 Hunter — deployed leader unit", () => {
  function deployedState() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.hunter, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.lukeSkywalker, 8)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.hunter)
      .WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker) // the unique name match
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // something to attack
      .WithActivePlayer(1);
  }

  it("has Overwhelm", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    const u = g.state.player1.groundArena[0];
    expect(HasOverwhelm(u.cardId, u.playId, 1)).toBe(true);
  });

  it("On Attack: accepting reveals a resource and swaps it for the top of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // declare the attack target; On Attack fires after
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await revealResource(g, 0);

    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.lukeSkywalker);
    expect(g.state.player1.resources.some(r => r.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });

  it("On Attack: declining changes nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    const resourcesBefore = g.state.player1.resources.length;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.resources).toHaveLength(resourcesBefore);
    expect(g.state.player1.deck).toHaveLength(1);
  });

  it("On Attack: a non-matching reveal does nothing", async () => {
    const g = new GameTestAdapter();
    const state = deployedState().Build();
    state.player1.groundArena.splice(1, 1); // remove the unique Luke — no name match remains
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await revealResource(g, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(1);
  });
});
