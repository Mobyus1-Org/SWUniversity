import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SOR_004 Chirrut Îmwe — Action [Exhaust]: Give a unit +0/+2 for this phase.
// SHD_011 Kylo Ren      — Action [Exhaust, discard a card from your hand]: Give a unit +2/+0 for this phase.

function setup(leader: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

const stats = (g: GameTestAdapter, player: 1 | 2, i: number) => {
  const raw = (player === 1 ? g.state.player1 : g.state.player2).groundArena[i];
  const u = Unit.FromInterface(raw);
  return { power: u.CurrentPower(), hp: u.TotalHP() };
};

describe("SOR_004 Chirrut Îmwe", () => {
  it("gives a unit +0/+2 — HP only, power untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.chirrutImwe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
        .Build(),
    );

    const before = stats(g, 1, 0);
    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    const after = stats(g, 1, 0);

    expect(after.hp).toBe(before.hp + 2);
    expect(after.power).toBe(before.power); // +0 power — this is what POWER_MOD would have broken
  });

  it("may buff an enemy unit too ('a unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.chirrutImwe)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toContain(g.state.player2.groundArena[0].playId);
  });

  it("the extra HP lets a unit survive damage that would otherwise defeat it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.chirrutImwe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // 3/3 with 2 damage
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    // 3 HP + 2 = 5; 2 existing damage leaves it alive.
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(stats(g, 1, 0).hp).toBe(5);
  });
});

describe("SHD_011 Kylo Ren", () => {
  it("discards a card as the cost, then gives a unit +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.kyloRen)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const before = stats(g, 1, 0);
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // pay the discard cost
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard).toHaveLength(1);

    await g.chooseGroundUnitAsync(1, 0);
    const after = stats(g, 1, 0);

    expect(after.power).toBe(before.power + 2);
    expect(after.hp).toBe(before.hp); // +0 HP
  });

  it("is unavailable with an empty hand — the discard is a cost, and costs gate availability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.kyloRen)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    // Rejected outright — the leader must not be exhausted for an ability it cannot pay for.
    expect(g.state.player1.leader.ready).toBe(true);
    expect(stats(g, 1, 0).power).toBe(3);
  });
});
