import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// ASH_097 Moff Gideon (Remnant Commander) (2/5 Ground) —
// "Sentinel" + "When Defeated: You may return a non-unique Imperial unit from your discard to your hand."
function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_097 Moff Gideon (Remnant Commander)", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.moffGideonRemnantCommander).Build());
    const gideon = g.state.player1.groundArena[0];
    expect(HasKeyword(Cards.units.ash.moffGideonRemnantCommander, "Sentinel", gideon.playId, 1)).toBe(true);
  });

  it("When Defeated: returns a chosen non-unique Imperial unit from discard to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.moffGideonRemnantCommander)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards) // 4 power kills the 2/5? no — 5 HP
        .WithCardInDiscardForPlayer(1, Cards.units.sor.seasonedShoretrooper) // a non-unique Imperial unit
        .Build(),
    );
    // Make Gideon lethal to the counter-attack: pre-damage him to 1 HP.
    g.state.player1.groundArena[0].damage = 4;
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0); // Gideon (5 damage on a 5-HP after? he has 4 dmg, 1 HP) attacks
    await g.chooseGroundUnitAsync(2, 0);     // 4-power Honor Guards counter kills Gideon
    await g.chooseYesAsync(1);               // use When Defeated
    const shoretrooperPlayId = g.state.player1.discard.find(c => c.cardId === Cards.units.sor.seasonedShoretrooper)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shoretrooperPlayId] });

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.ash.moffGideonRemnantCommander)).toBe(false);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.seasonedShoretrooper)).toBe(true);
    expect(g.state.player1.hand.length).toBe(handBefore + 1);
  });

  it("no prompt when the discard has no non-unique Imperial unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.moffGideonRemnantCommander)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)
        .Build(),
    );
    g.state.player1.groundArena[0].damage = 4;

    await g.attackWithGroundUnitAsync(1, 0);
    const res = await g.chooseGroundUnitAsync(2, 0);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});

// In puzzle mode the opponent (P2) controls Gideon. When the solving player defeats it, the
// "You may return…" When Defeated belongs to P2 — the human must never be prompted to resolve
// it. The puzzle harness auto-skips the opponent's optional ability.
describe("ASH_097 Moff Gideon (Remnant Commander) — puzzle mode (opponent controls it)", () => {
  // P2 controls a pre-damaged Gideon (4 damage on a 5-HP unit) and holds a non-unique Imperial
  // unit (SOR_081 Seasoned Shoretrooper) in their discard — an eligible return target. P1's
  // Battlefield Marine (3 power) finishes Gideon off, firing the enemy When Defeated ability.
  const rawPuzzle = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_029", damage: 0, epicActionUsed: false },
      leader: { cardId: "SOR_007", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [
        { cardId: "SOR_095", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
      ],
      spaceArena: [],
      resources: Array(3).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: "SOR_023", damage: 0, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [
        { cardId: "ASH_097", playId: "@", owner: 2, controller: 2, ready: true, damage: 4, upgrades: [], captives: [] },
      ],
      spaceArena: [],
      resources: Array(3).fill(null).map(() => ({ cardId: "LAW_174", playId: "@", owner: 2, controller: 2, ready: true })),
      discard: [{ cardId: "SOR_081", playId: "@", owner: 2, controller: 2 }], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };

  function newCtx(): EngineContext {
    const gs = hydratePuzzleGame(rawPuzzle as never);
    const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
    return { game, pending: null };
  }

  function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
    return processPuzzleDispatch(
      { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
      ctx,
    );
  }

  it("auto-skips the enemy When Defeated ability instead of prompting the human", () => {
    const ctx = newCtx();
    const marineId = ctx.game.currentGameState.player1.groundArena[0].playId;
    const gideonId = ctx.game.currentGameState.player2.groundArena[0].playId;

    let res = dispatch(ctx, "initiate-attack", { playId: marineId });
    if (res.response.resolutionNeeded) {
      res = dispatch(res.context, "choose-target", { targetPlayIds: [gideonId] });
    }

    const gs = res.context.game.currentGameState;
    // Gideon was defeated.
    expect(gs.player2.groundArena.some(u => u.cardId === "ASH_097")).toBe(false);
    // The opponent's optional When Defeated auto-skipped: no pending is left for the human,
    // and the Imperial unit stayed in P2's discard (not returned to hand).
    expect(res.context.pending).toBeNull();
    expect(gs.player2.hand).toHaveLength(0);
    expect(gs.player2.discard.some(c => c.cardId === "SOR_081")).toBe(true);
  });
});
