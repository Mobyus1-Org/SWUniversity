import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_044 Single Reactor Ignition (Event, cost 8, Vigilance/Aggression/Villainy, Disaster/Tactic)
// "Defeat all units. For each enemy unit defeated this way, deal 1 damage to its controller's base."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, Cards.events.law.singleReactorIgnition);
}

describe("LAW_044 Single Reactor Ignition", () => {
  it("defeats ALL units — friendly and enemy, ground and space", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("deals 1 damage to the enemy base per ENEMY unit defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(3); // 3 enemy units defeated
    expect(g.state.player1.base.damage).toBe(0); // your own losses deal nothing
  });

  it("your own defeated units deal NO damage to your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0); // still wiped
    expect(g.state.player1.base.damage).toBe(0); // but no base damage
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("deals no base damage when the opponent has no units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.base.damage).toBe(0);
  });

  it("still resolves with an empty board", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(0); // the event was played
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("a defeated unit's When Defeated ability still fires", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        // K-2SO: "When Defeated: for each opponent, choose one: deal 3 to their base, or they discard."
        .WithGroundUnitForPlayer(1, Cards.units.sor.k2so)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "deal_base_damage=2,3");

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(3); // K-2SO's trigger resolved despite the wipe
  });
});
