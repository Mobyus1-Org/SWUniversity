import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { computeUnitBuffs } from "@/server/engine/dispatch-listener";
import { PHASE_STAT_MOD, POWER_MOD } from "@/lib/engine/core-models";

// computeUnitBuffs drives the stat badge on a unit's card in the Puzzles UI. It reported only
// POSITIVE modifiers, so a debuff (Karis's When Defeated –2/–2, Talzin's Assassin –3/–3, …) left
// no trace on the board at all — the unit just silently traded worse.
describe("computeUnitBuffs", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren);
  }

  it("reports a negative modifier", () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3/7
      .Build();
    const playId = state.player1.groundArena[0].playId;
    state.currentEffects.push({
      cardId: PHASE_STAT_MOD,
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: playId,
      value: -3,
    });
    g.loadNewState(state);

    expect(computeUnitBuffs(g.state)[playId]).toEqual({ power: -3, hp: -3 });
  });

  it("still reports a positive modifier", () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .Build();
    const playId = state.player1.groundArena[0].playId;
    state.currentEffects.push({
      cardId: PHASE_STAT_MOD,
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: playId,
      value: 2,
    });
    g.loadNewState(state);

    expect(computeUnitBuffs(g.state)[playId]).toEqual({ power: 2, hp: 2 });
  });

  it("reports a power-only modifier without inventing an HP change", () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .Build();
    const playId = state.player1.groundArena[0].playId;
    state.currentEffects.push({
      cardId: POWER_MOD,
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: playId,
      value: -2,
    });
    g.loadNewState(state);

    expect(computeUnitBuffs(g.state)[playId]).toEqual({ power: -2, hp: 0 });
  });

  it("control: an unmodified unit has no entry", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce).Build());

    const playId = g.state.player1.groundArena[0].playId;
    expect(computeUnitBuffs(g.state)[playId]).toBeUndefined();
  });
});
