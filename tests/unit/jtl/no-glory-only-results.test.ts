import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_043 No Glory, Only Results — "Take control of a non-leader unit, then defeat it."

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.events.jtl.noGloryOnlyResults);
}

describe("JTL_043 No Glory, Only Results", () => {
  it("takes control of an enemy unit and defeats it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(0); // defeated, not kept
    // The card returns to its owner's discard, not the controller's.
    expect(g.state.player2.discard.map(c => c.cardId)).toContain(Cards.units.sor.gamorreanGuards);
  });

  it("defeats the unit under YOUR control, so its When Defeated fires for you", async () => {
    const g = new GameTestAdapter();
    // K-2SO: "When Defeated: For each opponent, choose one: deal 3 damage to that
    // player's base, or that player discards a card." Stolen and defeated by P1, the
    // choice is P1's and its opponent is P2 — the whole point of this card.
    g.loadNewState(baseState().WithGroundUnitForPlayer(2, Cards.units.sor.k2so).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(3); // P1 aimed K-2SO's trigger at P2
  });

  it("can target a friendly unit (taking control of your own is a no-op, then it dies)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(Cards.units.sor.gamorreanGuards);
  });

  it("works on a space unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player1.spaceArena).toHaveLength(0);
  });

  it("does not offer a leader unit as a target ('non-leader unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // a leader unit in the arena
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // Targeting the leader is rejected; only the non-leader unit is eligible.
    const leaderPlayId = g.state.player2.groundArena.find(
      u => u.cardId === Cards.leaders.sor.sabineWren,
    )!.playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(2); // nothing was stolen or defeated
  });
});
