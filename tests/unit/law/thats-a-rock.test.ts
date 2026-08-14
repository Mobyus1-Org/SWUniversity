import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_206 That's a Rock (Event, cost 1) —
// "Deal 1 damage to a unit.
//  When this event is discarded from your hand or deck: You may deal 1 damage to a unit."
function setup() {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.law.thatsARock)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build(),
  );
  return g;
}

describe("LAW_206 That's a Rock — play effect", () => {
  it("deals 1 damage to the chosen enemy unit", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("can target a friendly unit", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("the damage is mandatory — a target prompt is raised, not a skippable option", async () => {
    const g = setup();
    const res = await g.playCardFromHandAsync(1, 0);

    expect(res.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  // Control: playing the event normally is NOT a discard — the reaction must not fire.
  it("does not fire the discard reaction when played normally", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });
});

// Hand path — SOR_147 Black One's "You may discard your hand" discards the rock from hand.
function handDiscardSetup() {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.sor.blackOne)
      .WithCardInHandForPlayer(1, Cards.events.law.thatsARock)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build(),
  );
  return g;
}

describe("LAW_206 That's a Rock — discard reaction", () => {
  it("discarded from hand: may deal 1 damage to a unit", async () => {
    const g = handDiscardSetup();
    await g.playCardFromHandAsync(1, 0); // Black One
    await g.chooseYesAsync(1); // discard hand (incl. the rock), draw 3

    expect(g.state.player1.discard.some(c => c.cardId === Cards.events.law.thatsARock)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseYesAsync(1); // use the reaction
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("the reaction can be declined", async () => {
    const g = handDiscardSetup();
    await g.playCardFromHandAsync(1, 0); // Black One
    await g.chooseYesAsync(1); // discard hand
    await g.chooseOptionAsync(1, "Skip");

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  // Deck path — SOR_204 Greedo's When Defeated mill discards the rock from the deck. Greedo's
  // own "if it's not a unit, deal 2 to a ground unit" follow-up finds no ground units (both
  // Greedo and the attacking Marine die), leaving only the rock's reaction; its 1 damage
  // targets the surviving space unit.
  it("discarded (milled) from the deck: may deal 1 damage to a unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      // Sabine has no friendly-unit-defeated reaction — Boba Fett's would race the rock's
      // trigger and turn this into a trigger-order test.
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.greedo)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);
    state.player1.deck = [{ cardId: Cards.events.law.thatsARock }];
    const greedoPlayId = state.player1.groundArena[0].playId;
    const spaceTargetPlayId = state.player2.spaceArena[0].playId;

    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [greedoPlayId] });
    await g.chooseYesAsync(1); // Greedo: mill the top card (the rock)

    expect(g.state.player1.discard.some(c => c.cardId === Cards.events.law.thatsARock)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseYesAsync(1); // use the reaction
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [spaceTargetPlayId] });

    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });
});
