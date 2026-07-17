import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// ASH_197 Executor (5/12 Space, cost 8) —
// "This unit gets +1/+0 for each upgrade on other friendly units.
//  When Played: Give an Advantage token to each other friendly unit."

function advantageCount(u: { upgrades: { cardId: string }[] }): number {
  return u.upgrades.filter(upg => upg.cardId === "ASH_T02").length;
}

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_197 Executor — static buff", () => {
  it("gets +0/+0 when no other friendly unit has an upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.executor)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .Build(),
    );
    const executor = Unit.FromInterface(g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.executor)!);
    expect(executor.CurrentPower()).toBe(5);
  });

  it("gets +1/+0 when another friendly unit has 1 upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.executor)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithUpgradesOnSpaceUnitForPlayer(1, 1, [
          { cardId: Cards.upgrades.sor.entrenched, playId: "@", owner: 1, controller: 1 },
        ])
        .Build(),
    );
    const executor = Unit.FromInterface(g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.executor)!);
    expect(executor.CurrentPower()).toBe(6);
  });

  it("gets +2/+0 when 2 upgrades are spread across other friendly units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.executor)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnSpaceUnitForPlayer(1, 1, [
          { cardId: Cards.upgrades.token.advantage, playId: "@", owner: 1, controller: 1 },
        ])
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.token.advantage, playId: "@", owner: 1, controller: 1 },
        ])
        .Build(),
    );
    const executor = Unit.FromInterface(g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.executor)!);
    // Advantage tokens carry no printed power/hp — isolates the per-upgrade count from any
    // stat bonus the upgrade itself might grant.
    expect(executor.CurrentPower()).toBe(7);
  });

  it("does not count an upgrade attached to itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.executor)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.token.advantage, playId: "@", owner: 1, controller: 1 },
        ])
        .Build(),
    );
    const executor = Unit.FromInterface(g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.executor)!);
    // The Advantage token's own +1/+0 still applies (unrelated existing mechanic), but the
    // "for each upgrade on OTHER friendly units" count contributes nothing since Executor is
    // the only unit in play.
    expect(executor.CurrentPower()).toBe(6);
  });
});

describe("ASH_197 Executor — When Played", () => {
  it("gives no tokens when there are no other friendly units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithCardInHandForPlayer(1, Cards.units.ash.executor).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.length).toBe(1);
    expect(advantageCount(g.state.player1.spaceArena[0])).toBe(0);
  });

  it("gives an Advantage token to a single other friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.ash.executor)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const other = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.systemPatrolCraft)!;
    expect(advantageCount(other)).toBe(1);
    const executor = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.ash.executor)!;
    expect(advantageCount(executor)).toBe(0); // not itself
  });

  it("gives an Advantage token to each of two other friendly units, not to the enemy's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.ash.executor)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const friendlySpace = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.systemPatrolCraft)!;
    const friendlyGround = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    const enemyGround = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(advantageCount(friendlySpace)).toBe(1);
    expect(advantageCount(friendlyGround)).toBe(1);
    expect(advantageCount(enemyGround)).toBe(0);
  });
});
