import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// CR 5.6.1 — "A game ends immediately once a player's base reaches 0 remaining HP and is defeated."
// CR 3.2.5 — "A player cannot resolve actions, abilities, or effects once their base's remaining HP
//             reaches 0."
//
// One instance of damage can defeat a base and a unit at the same time. The unit's When Defeated
// TRIGGERS, but the game was already decided, so it never RESOLVES. Reported from a puzzle: the
// solver's Droid Missile Platform bombed the opponent for exactly lethal, and the opponent's K-2SO
// died in the same instance — its When Defeated then killed the solver back and scored a loss.
describe("game-over timing — nothing resolves after a base is defeated", () => {
  /**
   * Solver's Droid Missile Platform is Vanquished; its 3 indirect goes at the opponent, whose base
   * has 2 HP and whose K-2SO has 1. The auto-assignment spends 1 on K-2SO and 2 on the base, so
   * both die at once.
   */
  function board(p1BaseDamage: number): EngineContext {
    const raw = {
      activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
      initiativePlayer: 2, initiativeClaimed: true,
      player1: {
        base: { cardId: "SOR_020", damage: p1BaseDamage, epicActionUsed: false },
        leader: { cardId: "SOR_005", ready: true, deployed: false, epicActionUsed: false },
        groundArena: [],
        spaceArena: [{ cardId: "JTL_162", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] }],
        resources: Array(12).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
        discard: [], deck: [], hand: [{ cardId: "SOR_078" }], // Vanquish
        supplemental: { creditTokens: 0, forceToken: false },
      },
      player2: {
        base: { cardId: "SOR_023", damage: 28, epicActionUsed: false }, // 2 HP left
        leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
        // K-2SO 4/4 on 3 damage → 1 HP left. Its When Defeated can deal 3 to the opponent's base.
        groundArena: [{ cardId: "SOR_145", playId: "@", owner: 2, controller: 2, ready: true, damage: 3, upgrades: [], captives: [] }],
        spaceArena: [],
        resources: [], discard: [], deck: [], hand: [],
        supplemental: { creditTokens: 0, forceToken: false },
      },
      currentEffects: [], triggerBag: [],
    };
    const gs = hydratePuzzleGame(raw as never);
    return { game: { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] } as Game, pending: null };
  }

  function bombTheOpponent(ctx: EngineContext) {
    const dmp = ctx.game.currentGameState.player1.spaceArena[0].playId;
    const d = (type: string, data: Record<string, unknown>, c: EngineContext) =>
      processPuzzleDispatch(
        { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
        c,
      );
    const r1 = d("play-card", { cardId: "SOR_078", fromZone: "Hand" }, ctx);
    const r2 = d("choose-target", { targetPlayIds: [dmp] }, r1.context);
    return d("choose-option", { option: "Opponent" }, r2.context);
  }

  it("the solver wins, and K-2SO's When Defeated never resolves", () => {
    // The solver's base is on 28 too — if K-2SO's trigger resolved, it would deal 3 and kill them.
    const res = bombTheOpponent(board(28));
    const gs = res.context.game.currentGameState;

    expect(gs.defeatedPlayers).toEqual([2]);       // opponent only — a clean win
    expect(gs.player1.base.damage).toBe(28);       // untouched; the trigger never went off
    expect(gs.player2.groundArena).toHaveLength(0); // K-2SO still died
  });

  it("terminates instead of hanging", () => {
    // The auto-resolve loop used to re-issue the same rejected answer forever once the game ended.
    const started = board(28);
    expect(() => bombTheOpponent(started)).not.toThrow();
  });

  it("control: with the game NOT over, the same When Defeated does resolve", () => {
    // Opponent's base at 20 → the 3 indirect cannot finish it, so play continues and K-2SO's
    // trigger lands its 3 on the solver's base as normal.
    const ctx = board(0);
    ctx.game.currentGameState.player2.base.damage = 20;

    const res = bombTheOpponent(ctx);
    const gs = res.context.game.currentGameState;

    expect(gs.defeatedPlayers).toEqual([]);
    expect(gs.player2.groundArena).toHaveLength(0); // K-2SO died to the indirect damage
    expect(gs.player1.base.damage).toBe(3);         // and got its revenge
  });
});
