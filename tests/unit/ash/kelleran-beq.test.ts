import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { POWER_MOD, PlayerId } from "@/lib/engine/core-models";
import type { GameState } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// ASH_206 Kelleran Beq (3/5 Ground, cost 4)
// "Ambush"
// "This unit gets +1/+0 for each other unit (friendly and enemy) with 0 power."
//
// No card in the DB is printed with 0 power, so 0-power units are produced here the way they
// arise in play: a –X/–0 debuff (POWER_MOD) that takes a low-power unit down to 0.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

/** Zeroes a unit's power with a phase-long –X/–0 effect, the same shape GivePowerMod produces. */
function zeroPower(state: GameState, player: PlayerId, playId: string, amount: number) {
  state.currentEffects.push({
    cardId: POWER_MOD,
    duration: "Phase",
    affectedPlayer: player,
    targetPlayId: playId,
    value: -amount,
  });
}

describe("ASH_206 Kelleran Beq", () => {
  it("is base 3 power when no other unit has 0 power (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)
        .WithGroundUnitForPlayer(1, Cards.units.ash.mouseDroid)         // 1 power, undebuffed
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // 3 power
        .Build(),
    );

    const kb = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.kelleranBeq)!;
    expect(Unit.FromInterface(kb).CurrentPower()).toBe(3);
  });

  it("gets +1/+0 for each other 0-power unit, friendly and enemy", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)
      .WithGroundUnitForPlayer(1, Cards.units.ash.mouseDroid)         // 1 power → 0
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // 3 power → 0
      .WithSpaceUnitForPlayer(2, Cards.units.ash.attendantNavigator)  // stays above 0
      .Build();
    zeroPower(state, 1, state.player1.groundArena[1].playId, 1);
    zeroPower(state, 2, state.player2.groundArena[0].playId, 3);
    g.loadNewState(state);

    const kb = g.state.player1.groundArena[0];
    expect(Unit.FromInterface(kb).CurrentPower()).toBe(5); // 3 base + 2
  });

  it("does not count itself when its own power is reduced to 0", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)
      .Build();
    zeroPower(state, 1, state.player1.groundArena[0].playId, 3);
    g.loadNewState(state);

    // 3 base – 3 debuff = 0, and "each OTHER unit" excludes itself, so it stays at 0.
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(0);
  });

  it("two Kellerans each see the other at 0 power without infinite recursion", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)
      .WithGroundUnitForPlayer(2, Cards.units.ash.kelleranBeq)
      .Build();
    zeroPower(state, 2, state.player2.groundArena[0].playId, 3);
    g.loadNewState(state);

    // The enemy Kelleran is at 0 printed-power-after-debuff, so ours gets +1.
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(4);
  });

  it("has Ambush — may attack an enemy unit on entering play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.kelleranBeq)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // 3 power kills the 3-HP Marine
  });
});
