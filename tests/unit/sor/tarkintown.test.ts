import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";

// SOR_025 Tarkintown — Base (Aggression), 25 HP
// "Epic Action: Deal 3 damage to a damaged non-leader unit."

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.sor.tarkintown)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5);
}

describe("SOR_025 Tarkintown", () => {
  it("deals 3 damage to a chosen damaged unit", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce, true, 1) // 6/8, damaged
      .Build();
    g.loadNewState(state);

    await g.useBaseAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(4); // 1 + 3
    expect(g.state.player1.base.epicActionUsed).toBe(true);
  });

  it("can defeat the unit outright", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 1) // 3/3, 1 damage
      .Build();
    g.loadNewState(state);

    await g.useBaseAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("offers only DAMAGED units, and never a leader unit", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce, true, 2) // damaged
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 0) // undamaged
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.darthVader, true, 3) // damaged LEADER unit
      .Build();
    g.loadNewState(state);

    await g.useBaseAbilityAsync(1);

    const targets = TargetIds(g);
    expect(targets).toContain(state.player2.groundArena[0].playId); // damaged
    expect(targets).not.toContain(state.player2.groundArena[1].playId); // undamaged
    expect(targets).not.toContain(state.player1.groundArena[0].playId); // leader unit
  });

  it("can target a friendly damaged unit ('a unit' — either side)", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(1, Cards.units.lof.priestessesOfTheForce, true, 1)
      .Build();
    g.loadNewState(state);

    await g.useBaseAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].damage).toBe(4);
  });

  it("is rejected when there is no damaged non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());

    await g.useBaseAbilityAsync(1);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.base.epicActionUsed).toBe(false); // not spent on a fizzle
  });

  it("cannot be used twice", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce, true, 1)
      .Build();
    state.player1.base.epicActionUsed = true;
    g.loadNewState(state);

    await g.useBaseAbilityAsync(1);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
