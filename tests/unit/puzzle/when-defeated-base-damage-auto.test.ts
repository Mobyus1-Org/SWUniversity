import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// "When Defeated: Deal N damage to a base" asks its controller which base. When the OPPONENT owns
// the dying unit that choice belongs to P2, so the solver defeating it must not be handed an
// enemy prompt — unmapped, it threw "Puzzle Auto Target not set" and the board looked frozen.
//
// QA hit this defeating Cavern Angels X-Wing (LAW_189).

function newCtx(): EngineContext {
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_020", damage: 0, epicActionUsed: false },
      leader: { cardId: "SOR_005", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [],
      // Hyperspace Wayfarer 4/10 — kills the 2/1 X-Wing and survives the counter-swing.
      spaceArena: [{
        cardId: "LOF_119", playId: "@", owner: 1, controller: 1, ready: true, damage: 0,
        upgrades: [], captives: [],
      }],
      resources: Array(6).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: "SOR_023", damage: 0, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [],
      // Cavern Angels X-Wing 2/1 — "When Defeated: Deal 2 damage to a base."
      spaceArena: [{
        cardId: "LAW_189", playId: "@", owner: 2, controller: 2, ready: true, damage: 0,
        upgrades: [], captives: [],
      }],
      resources: [], discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };
  const gs = hydratePuzzleGame(raw as never);
  return { game: { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] } as Game, pending: null };
}

/** The solver attacks the enemy X-Wing and defeats it. */
function attackTheXWing(ctx: EngineContext) {
  const gs = ctx.game.currentGameState;
  const atk = gs.player1.spaceArena[0].playId;
  const def = gs.player2.spaceArena[0].playId;
  const r1 = processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: "initiate-attack" as never, dispatchData: { playId: atk } as never, fromPlayer: 1 },
    ctx,
  );
  return processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: "choose-target" as never, dispatchData: { targetPlayIds: [def] } as never, fromPlayer: 1 },
    r1.context,
  );
}

describe("puzzle mode — the opponent's 'deal N damage to a base' on defeat resolves automatically", () => {
  it("LAW_189 Cavern Angels X-Wing does not throw, and aims its 2 at the solver's base", () => {
    const ctx = newCtx();

    const res = attackTheXWing(ctx);

    expect(res.context.game.currentGameState.player2.spaceArena).toHaveLength(0); // defeated
    expect(res.context.pending).toBeNull(); // resolved without stranding a prompt on the solver
    expect(res.context.game.currentGameState.player1.base.damage).toBe(2); // P2 aims at the solver
    expect(res.context.game.currentGameState.player2.base.damage).toBe(0);
  });
});
