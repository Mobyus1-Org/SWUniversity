import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_017 Han Solo (Audacious Smuggler) — 4/6 Ground leader, cost 6.
// FRONT:    Action [exhaust]: Put a card from your hand into play as a resource and ready it.
//           At the start of the next action phase, defeat a resource you control.
// DEPLOYED: On Attack: Put the top card of your deck into play as a resource and ready it.
//           At the start of the next action phase, defeat a resource you control.

/** Passes both players' actions, then both regroup-resource steps, landing in the next action phase. */
async function advanceToNextActionPhase(g: GameTestAdapter) {
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-resource", {});
  await g.dispatchAsync(g.state.activePlayer, "pass-resource", {});
}

function frontState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.hanSolo)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
    .WithCardInHandForPlayer(1, Cards.units.sor.gamorreanGuards)
    .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
    .WithCardInDeckForPlayer(2, Cards.units.sor.consularSecurityForce)
    .WithActivePlayer(1);
}

describe("SOR_017 Han Solo — leader (front) ability", () => {
  it("puts a chosen card from hand into play as a READY resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().Build());

    const resourcesBefore = g.state.player1.resources.length;
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.resources).toHaveLength(resourcesBefore + 1);
    const added = g.state.player1.resources.find(r => r.cardId === Cards.units.sor.gamorreanGuards);
    expect(added).toBeDefined();
    expect(added!.ready).toBe(true); // "and ready it"
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust
  });

  it("is not offered with an empty hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.yellow30HP)
        .MyLeader(Cards.leaders.sor.hanSolo)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("at the start of the next action phase, prompts to defeat a resource you control", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    const afterResourcing = g.state.player1.resources.length;

    await advanceToNextActionPhase(g);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    const chosen = g.state.player1.resources[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [chosen] });

    // +1 drawn-and-resourced? No — the regroup resource step was passed, so only the defeat applies.
    expect(g.state.player1.resources).toHaveLength(afterResourcing - 1);
    expect(g.state.player1.resources.some(r => r.playId === chosen)).toBe(false);
  });

  it("the delayed defeat fires only once, not every phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    await advanceToNextActionPhase(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.resources[0].playId] });
    const afterFirst = g.state.player1.resources.length;

    await advanceToNextActionPhase(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.resources).toHaveLength(afterFirst);
  });

  it("the opponent is never asked to defeat a resource ('a resource YOU control')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 6).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    const p2Before = g.state.player2.resources.length;

    await advanceToNextActionPhase(g);
    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds ?? [];
    const p2PlayIds = g.state.player2.resources.map(r => r.playId);

    expect(targets.some(t => p2PlayIds.includes(t))).toBe(false);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.resources[0].playId] });
    expect(g.state.player2.resources).toHaveLength(p2Before);
  });

  // The combo: Millennium Falcon's start-of-phase tax exhausts a resource, and Han's delayed
  // defeat then removes that very resource — so the action phase opens with everything ready.
  it("combos with Millennium Falcon: pay the tax, then defeat the exhausted resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithSpaceUnitForPlayer(1, Cards.units.sor.millenniumFalconSor).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    await advanceToNextActionPhase(g);

    // 1) The Falcon asks first — pay 1, which exhausts a resource.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    const exhausted = g.state.player1.resources.filter(r => !r.ready);
    expect(exhausted).toHaveLength(1);

    // 2) Han's delayed defeat follows — take the resource the Falcon just exhausted.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [exhausted[0].playId] });

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.sor.millenniumFalconSor)).toBe(true);
    expect(g.state.player1.resources.every(r => r.ready)).toBe(true); // nothing left exhausted
  });
});

describe("SOR_017 Han Solo — deployed leader unit", () => {
  function deployedState() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.hanSolo, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
      .WithCardInDeckForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.hanSolo)
      .WithActivePlayer(1);
  }

  it("On Attack: puts the top card of the deck into play as a READY resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    const resourcesBefore = g.state.player1.resources.length;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.resources).toHaveLength(resourcesBefore + 1);
    const added = g.state.player1.resources.find(r => r.cardId === Cards.units.sor.consularSecurityForce);
    expect(added?.ready).toBe(true);
    expect(g.state.player1.deck).toHaveLength(0);
  });

  it("On Attack: also schedules the start-of-next-action-phase defeat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const afterAttack = g.state.player1.resources.length;

    await advanceToNextActionPhase(g);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.resources[0].playId] });

    expect(g.state.player1.resources).toHaveLength(afterAttack - 1);
  });

  it("On Attack with an empty deck: no resource, but the delayed defeat still applies", async () => {
    const g = new GameTestAdapter();
    const state = deployedState().Build();
    state.player1.deck = [];
    g.loadNewState(state);

    const resourcesBefore = g.state.player1.resources.length;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.resources).toHaveLength(resourcesBefore);

    await advanceToNextActionPhase(g);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });
});
