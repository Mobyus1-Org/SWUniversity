import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";
import { Unit } from "@/server/engine/unit";

// SOR_028 Jedha City — Base (Cunning), 25 HP
// "Epic Action: Give a non-leader unit -4/-0 for this phase."

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.sor.jedhaCity)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5);
}

function powerOf(g: GameTestAdapter, playId: string): number {
  const all = [...g.state.player1.groundArena, ...g.state.player1.spaceArena,
    ...g.state.player2.groundArena, ...g.state.player2.spaceArena];
  return Unit.FromInterface(all.find(u => u.playId === playId)!).CurrentPower();
}

describe("SOR_028 Jedha City", () => {
  it("gives the chosen unit -4/-0 for the phase", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce) // 6/8
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;
    expect(powerOf(g, targetPlayId)).toBe(6);

    await g.useBaseAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(powerOf(g, targetPlayId)).toBe(2); // 6 - 4
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });

  it("leaves HP untouched (-4/-0, not -4/-4)", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce) // 6/8
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.useBaseAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const unit = g.state.player2.groundArena[0];
    expect(Unit.FromInterface(unit).CurrentHP()).toBe(8); // unchanged
    expect(unit.damage).toBe(0);
  });

  it("does not reduce power below 0", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 power
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.useBaseAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(powerOf(g, targetPlayId)).toBeGreaterThanOrEqual(0);
  });

  it("never offers a leader unit", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.darthVader) // leader unit
      .Build();
    g.loadNewState(state);

    await g.useBaseAbilityAsync(1);

    const targets = TargetIds(g);
    expect(targets).toContain(state.player2.groundArena[0].playId);
    expect(targets).not.toContain(state.player1.groundArena[0].playId);
  });

  it("is rejected when there is no non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.useBaseAbilityAsync(1);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.base.epicActionUsed).toBe(false);
  });

  it("cannot be used twice", async () => {
    const g = new GameTestAdapter();
    const state = setup().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build();
    state.player1.base.epicActionUsed = true;
    g.loadNewState(state);

    await g.useBaseAbilityAsync(1);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
