import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TS26_09 First Battle Memorial (Base) — "Epic Action: For each friendly leader unit,
// give an Experience token to a unit."
//
// "For each friendly leader unit" is the shared TS26 base scaling. A leader unit is a
// LEADER-typed card sitting in an arena, so an undeployed leader counts for nothing and
// an enemy leader unit you have taken control of counts for you.

const xpOn = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === Cards.upgrades.token.experience).length;

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.ts26.firstBattleMemorial)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10);
}

describe("TS26_09 First Battle Memorial", () => {
  it("gives 1 Experience token for the one friendly leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku) // the deployed leader unit
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 1);

    expect(xpOn(g.state.player1.groundArena[1])).toBe(1);
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });

  it("can put the token on the leader unit itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
  });

  it("can target an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
  });

  it("grants one token per leader unit when two are controlled", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        // A second leader unit under Player 1's control (e.g. seized from the opponent).
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.maul)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 2);
    await g.chooseGroundUnitAsync(1, 2); // both onto the same unit — each grant picks freely

    expect(xpOn(g.state.player1.groundArena[2])).toBe(2);
  });

  it("does nothing when no friendly leader unit is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku) // undeployed — not a leader UNIT
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });

  it("cannot be used twice in a round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ts26.countDooku, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.ts26.countDooku)
        .Build(),
    );

    await g.useBaseAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});

    await g.useBaseAbilityAsync(1);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
  });
});
