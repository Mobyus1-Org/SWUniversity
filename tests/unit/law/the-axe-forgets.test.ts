import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_246 The Axe Forgets — cost 2 Cunning event.
// "Return a non-leader unit that costs 3 or less to its owner's hand."

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.law.theAxeForgets);
}

describe("LAW_246 The Axe Forgets", () => {
  it("returns a 2-cost enemy unit to its owner's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build(), // cost 2
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
  });

  it("can return a friendly unit ('a non-leader unit', either side)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
  });

  it("cannot target a unit that costs 4 or more", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // cost 4
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // cost 2 — keeps the prompt live
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const guardsPlayId = g.state.player2.groundArena[0].playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [guardsPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(2);
  });

  it("cannot target a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const leaderPlayId = g.state.player2.groundArena[0].playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(2);
  });

  it("does not prompt when no unit costs 3 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("a token unit is set aside, not returned to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(2, Cards.units.token.battleDroid).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(0);
  });

  it("upgrades do not change the printed cost the ability reads", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([Cards.units.sor.battlefieldMarine]);
  });

  it("cannot return a 2-cost ship piloted by Chewbacca (JTL_103)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.phoenixSquadronAWing) // cost 2
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.chewbacca, 2),
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // No other legal target exists, so the event fizzles entirely.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.spaceArena).toHaveLength(1);
  });

  it("but CAN return your OWN Chewbacca-piloted ship (the immunity is to ENEMY abilities)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.phoenixSquadronAWing)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.chewbacca, 1),
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.jtl.phoenixSquadronAWing);
  });
});
