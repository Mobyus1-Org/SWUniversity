import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_079 Shatterpoint — "Choose one:
//   Defeat a non-leader unit with 3 or less remaining HP.
//   Use the Force (lose your Force token). If you do, defeat a non-leader unit."
//
// Gamorrean Guards has 4 HP (too healthy for mode A unless damaged);
// Battlefield Marine has 3 HP (always a legal mode-A target).

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
    .WithCardInHandForPlayer(1, Cards.events.lof.shatterpoint);
}

describe("LOF_079 Shatterpoint", () => {
  it("mode A: defeats a non-leader unit with 3 or less remaining HP, no Force spent", async () => {
    const g = new GameTestAdapter();
    const s = baseState().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build();
    s.player1.supplemental.forceToken = true; // available, but mode A must not spend it
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "defeat_low_hp");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.supplemental.forceToken).toBe(true); // untouched
  });

  it("mode A counts REMAINING HP, so a damaged big unit is eligible", async () => {
    const g = new GameTestAdapter();
    // Gamorrean Guards: 4 HP, 2 damage → 2 remaining, so mode A can defeat it.
    const s = baseState().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards, true, 2).Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // no Force token → mode A is the only mode, no prompt

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("mode B: uses the Force to defeat a unit with more than 3 remaining HP", async () => {
    const g = new GameTestAdapter();
    // Both modes live (the Marine keeps mode A available), but the player wants the
    // 4-HP Guards — only mode B can reach it.
    const s = baseState()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 HP
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4 HP
      .Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "use_force_then_defeat");
    await g.chooseGroundUnitAsync(2, 1); // the Guards

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([Cards.units.sor.battlefieldMarine]);
    expect(g.state.player1.supplemental.forceToken).toBe(false); // the Force was spent
  });

  it("offers both modes when both are live, and mode A cannot reach a 4-HP unit", async () => {
    const g = new GameTestAdapter();
    const s = baseState()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 HP — mode A legal
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4 HP — mode A illegal
      .Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "defeat_low_hp");

    // The 4-HP unit is not a legal mode-A target.
    const guardsPlayId = g.state.player2.groundArena.find(
      u => u.cardId === Cards.units.sor.gamorreanGuards,
    )!.playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [guardsPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(2);
  });

  it("skips the prompt when only mode A is live (no Force token)", async () => {
    const g = new GameTestAdapter();
    const s = baseState().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build();
    g.loadNewState(s); // no Force token

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // straight to the target step

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("skips the prompt when only mode B is live (no unit at 3 or less HP)", async () => {
    const g = new GameTestAdapter();
    const s = baseState().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build(); // 4 HP
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // straight to the target step; Force auto-spent

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });

  it("fizzles when no mode is live (healthy unit, no Force token)", async () => {
    const g = new GameTestAdapter();
    const s = baseState().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build();
    g.loadNewState(s); // no Force token, and the only unit has 4 HP

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena).toHaveLength(1); // nothing happened
    expect(g.state.player1.hand).toHaveLength(0); // the event was still played
  });

  it("does not offer a leader unit as a target", async () => {
    const g = new GameTestAdapter();
    const s = baseState()
      .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // leader unit in the arena
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s); // no Force token → mode A only

    await g.playCardFromHandAsync(1, 0);

    const leaderPlayId = g.state.player2.groundArena.find(
      u => u.cardId === Cards.leaders.sor.sabineWren,
    )!.playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [leaderPlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(2);
  });
});
