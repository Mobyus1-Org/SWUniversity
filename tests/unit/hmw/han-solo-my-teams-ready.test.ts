import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_170 Han Solo — My Team's Ready (4/7 Ground, cost 5, Aggression/Heroism, Rebel/Official,
// unique) —
//   "Action [Exhaust]: Ready another unit."
//
// "Another unit" is unqualified, so — like SOR_169 Keep Fighting — it spans BOTH players; only Han
// himself is excluded. Readying an enemy unit is a bad idea, not an illegal one.
//
// The exhaust is the cost, so an already-exhausted Han cannot use it, and using it must leave him
// exhausted even though the unit he readies stands up.

const HAN = "HMW_170";
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren) // Aggression
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

const han = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === HAN)!;

async function useHansAction(g: GameTestAdapter) {
  await g.dispatchAsync(1, "use-ability", { cardId: HAN, playId: han(g).playId });
}

describe("HMW_170 Han Solo — My Team's Ready", () => {
  it("readies an exhausted friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, HAN)
        .WithGroundUnitForPlayer(1, MARINE, false) // exhausted
        .Build(),
    );

    await useHansAction(g);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(1, idx);

    expect(g.state.player1.groundArena[idx].ready).toBe(true);
  });

  it("exhausts Han as the cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, HAN)
        .WithGroundUnitForPlayer(1, MARINE, false)
        .Build(),
    );

    await useHansAction(g);
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(1, idx);

    expect(han(g).ready).toBe(false);
  });

  it("does not offer himself — the text says 'another unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, HAN)
        .WithGroundUnitForPlayer(1, MARINE, false)
        .Build(),
    );

    await useHansAction(g);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    expect(pending?.type).toBe("Target");
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    expect(offered).not.toContain(han(g).playId);
  });

  it("can ready an ENEMY unit — 'another unit' is unqualified", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, HAN)
        .WithGroundUnitForPlayer(2, MARINE, false)
        .Build(),
    );

    await useHansAction(g);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("a readied unit can attack again in the same phase", async () => {
    // The whole point of the ability, and the thing a bare `ready = true` flag flip could miss.
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, HAN)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    const marineIdx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.attackWithGroundUnitAsync(1, marineIdx);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(3);

    await g.dispatchAsync(2, "pass-action", {});
    await useHansAction(g);
    await g.chooseGroundUnitAsync(1, marineIdx);

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, marineIdx);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(6); // attacked twice
  });

  it("an exhausted Han cannot use the ability", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, HAN, false) // already exhausted
        .WithGroundUnitForPlayer(1, MARINE, false)
        .Build(),
    );

    await useHansAction(g);

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    expect(g.state.player1.groundArena[idx].ready).toBe(false);
  });

  it("is not offered when Han is alone on the board", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, HAN).Build());

    await useHansAction(g);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(han(g).ready).toBe(true); // no cost paid for an ability that never happened
  });
});
