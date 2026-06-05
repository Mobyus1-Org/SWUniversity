import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_067 — Rugged Survivors (Unit, Vigilance, cost 5, Grit, 3/5)
// "Grit (This unit gets +1/+0 for each damage on it.)
//  On Attack: If you control a leader unit, you may draw a card."

describe("SOR_067 — Rugged Survivors", () => {
  it("prompts to draw a card when attacking and leader unit is deployed", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca) // Vigilance
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.ruggedSurvivors)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);

    state.player1.leader.deployed = true;
    const walkerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

    // Should prompt an Option (yes/no draw card).
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("draws a card when player chooses Yes", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.ruggedSurvivors)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    state.player1.leader.deployed = true;
    const walkerPlayId = state.player2.groundArena[0].playId;
    const initialHandSize = state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });
    await g.chooseYesAsync(1);

    // Player drew 1 card.
    expect(g.state.player1.hand.length).toBe(initialHandSize + 1);
  });

  it("does NOT draw a card when player chooses No", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.ruggedSurvivors)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    state.player1.leader.deployed = true;
    const walkerPlayId = state.player2.groundArena[0].playId;
    const initialHandSize = state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });
    await g.chooseNoAsync(1);

    // No draw.
    expect(g.state.player1.hand.length).toBe(initialHandSize);
  });

  it("does NOT prompt to draw when no leader unit is deployed", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.ruggedSurvivors)
      .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
      .Build();
    g.loadNewState(state);

    // Leader NOT deployed.
    const walkerPlayId = state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [walkerPlayId] });

    // No Option prompt — combat resolves directly.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
  });
});
