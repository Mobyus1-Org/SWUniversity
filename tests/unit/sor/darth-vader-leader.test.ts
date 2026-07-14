import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_010 Darth Vader — Dark Lord of the Sith
// Leader: "Action [1 resource, exhaust]: If you played a [Villainy] card this phase,
//          deal 1 damage to a unit and 1 damage to a base."
// Deployed: "On Attack: You may deal 2 damage to a unit." (already implemented)

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithInitiativePlayerBeing(2)
    .WithInitiativeClaimed(); // player 2 auto-passes, so player 1 can act twice
}

function readyCount(resources: { ready: boolean }[]): number {
  return resources.filter(r => r.ready).length;
}

describe("SOR_010 Darth Vader — Leader ability", () => {
  it("deals 1 damage to a unit and 1 damage to a base after a Villainy card was played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.cellBlockGuard) // Villainy
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // play the Villainy card
    const readyBefore = readyCount(g.state.player1.resources);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // 1 damage to a unit
    await g.chooseBaseAsync(1, 2); // 1 damage to the enemy base

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false); // exhausted
    expect(readyCount(g.state.player1.resources)).toBe(readyBefore - 1); // 1 resource
  });

  it("can aim the base damage at your own base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.cellBlockGuard)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 1); // "a base" — your own is legal

    expect(g.state.player1.base.damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("can aim the unit damage at a friendly unit ('a unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.cellBlockGuard)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.useLeaderAbilityAsync(1);
    const guardsIdx = g.state.player1.groundArena.findIndex(
      u => u.cardId === Cards.units.sor.gamorreanGuards,
    );
    await g.chooseGroundUnitAsync(1, guardsIdx);
    await g.chooseBaseAsync(1, 2);

    const guards = g.state.player1.groundArena.find(
      u => u.cardId === Cards.units.sor.gamorreanGuards,
    )!;
    expect(guards.damage).toBe(1);
  });

  it("soft-passes when no Villainy card was played this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // not Villainy
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // a non-Villainy card
    await g.useLeaderAbilityAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false); // still exhausts, like Iden Versio
  });

  it("cannot be activated at all with no resources to pay the [1 resource] cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.darthVader)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 0) // nothing to pay with
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    const result = await g.useLeaderAbilityAsync(1);

    // The cost gates the ability (unlike the "if you played a Villainy card" condition,
    // which only soft-passes): he can't be activated, so he isn't even exhausted.
    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("soft-passes when no card was played at all this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });
});
