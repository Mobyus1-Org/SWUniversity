import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_170 Double-Cross (Event, cost 6, Command, Trick)
// "Choose a friendly non-leader unit and an enemy non-leader unit. Exchange control of those
//  units. The player who takes control of the lower-cost unit creates Credit tokens equal to
//  the difference between those units' costs."
//
// Battlefield Marine (SOR_095) costs 2; Gamorrean Guards (SOR_211) costs 4.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, Cards.events.law.doubleCross);
}

describe("LAW_170 Double-Cross", () => {
  it("exchanges control of the two chosen units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // friendly, cost 2
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // enemy, cost 4
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // friendly unit
    await g.chooseGroundUnitAsync(2, 0); // enemy unit

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([Cards.units.sor.gamorreanGuards]);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([Cards.units.sor.battlefieldMarine]);
    // Ownership does not change — only control.
    expect(g.state.player1.groundArena[0].owner).toBe(2);
    expect(g.state.player1.groundArena[0].controller).toBe(1);
  });

  it("the player taking the LOWER-cost unit gets Credits equal to the cost difference", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2 → goes to player 2
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // cost 4 → goes to player 1
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Player 2 received the cheaper unit (cost 2), so player 2 gets 4 - 2 = 2 Credits.
    expect(g.state.player2.supplemental.creditTokens).toBe(2);
    expect(g.state.player1.supplemental.creditTokens ?? 0).toBe(0);
  });

  it("gives the Credits to YOU when you take the lower-cost unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards) // yours, cost 4 → to player 2
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // theirs, cost 2 → to you
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // You took the cheaper unit (cost 2), so you get 4 - 2 = 2 Credits.
    expect(g.state.player1.supplemental.creditTokens).toBe(2);
    expect(g.state.player2.supplemental.creditTokens ?? 0).toBe(0);
  });

  it("nobody gets Credits when the costs are equal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // cost 2
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.supplemental.creditTokens ?? 0).toBe(0);
    expect(g.state.player2.supplemental.creditTokens ?? 0).toBe(0);
  });

  it("works across arenas (a ground unit for a space unit)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // Each unit stays in its own arena, under the new controller.
    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([Cards.units.sor.systemPatrolCraft]);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([Cards.units.sor.battlefieldMarine]);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("does not offer a leader unit ('non-leader unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // a leader unit in the arena
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const leaderPlayId = g.state.player2.groundArena.find(
      u => u.cardId === Cards.leaders.sor.sabineWren,
    )!.playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("does nothing when either side has no eligible unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build(), // no enemy unit
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena).toHaveLength(1); // unchanged
  });
});
