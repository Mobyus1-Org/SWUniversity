import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_047 The Armorer — Survival Is Strength (3/5 Ground, cost 5, Heroism/Vigilance, Mandalorian) —
//   "When Played: Give a Shield token to each of up to 3 Mandalorian units."
//
// "EACH of up to 3" — at most one Shield per unit, across at most three distinct units. That is a
// multi-select, not a distribution: three tokens cannot be piled onto one unit.
//
// "Mandalorian units" is unqualified, so an enemy Mandalorian is a legal (if odd) choice, and the
// Armorer is herself a Mandalorian and may be one of the three.

const ARMORER = "SHD_047";
const SHIELD = Cards.upgrades.token.shield;
const MANDO = "SHD_258";                            // Mandalorian Warrior
const NON_MANDO = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, NON_MANDO, 14)
    .WithCardInHandForPlayer(1, ARMORER)
    .WithActivePlayer(1);
}

const shieldsOn = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === SHIELD).length;

describe("SHD_047 The Armorer", () => {
  it("gives one Shield to each of three chosen Mandalorians", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MANDO)
        .WithGroundUnitForPlayer(1, MANDO)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const ids = g.state.player1.groundArena.filter(u => u.cardId === MANDO || u.cardId === ARMORER)
      .map(u => u.playId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids.slice(0, 3) });

    for (const id of ids.slice(0, 3)) {
      const u = g.state.player1.groundArena.find(x => x.playId === id)!;
      expect(shieldsOn(u)).toBe(1); // one each, never stacked
    }
  });

  it("accepts fewer than three — it is 'up to'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MANDO).Build());

    await g.playCardFromHandAsync(1, 0);
    const one = g.state.player1.groundArena.find(u => u.cardId === MANDO)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [one] });

    expect(shieldsOn(g.state.player1.groundArena.find(u => u.playId === one)!)).toBe(1);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("does not offer a non-Mandalorian", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, NON_MANDO).Build());

    await g.playCardFromHandAsync(1, 0);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    const marine = g.state.player1.groundArena.find(u => u.cardId === NON_MANDO)!;
    expect(offered).not.toContain(marine.playId);
  });

  it("includes HERSELF — she is a Mandalorian", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    const self = g.state.player1.groundArena.find(u => u.cardId === ARMORER)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [self] });

    expect(shieldsOn(g.state.player1.groundArena.find(u => u.playId === self)!)).toBe(1);
  });

  it("caps at three even when more are chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MANDO)
        .WithGroundUnitForPlayer(1, MANDO)
        .WithGroundUnitForPlayer(1, MANDO)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const all = g.state.player1.groundArena.map(u => u.playId); // 4 Mandalorians
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: all });

    const shielded = g.state.player1.groundArena.filter(u => shieldsOn(u) > 0);
    expect(shielded).toHaveLength(3);
  });
});
