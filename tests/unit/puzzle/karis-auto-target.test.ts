import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import { PHASE_STAT_MOD } from "@/lib/engine/core-models";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game, GameState } from "@/lib/engine/game";

// LOF_031 Karis — "When Defeated: You may use the Force. If you do, give a unit –2/–2 for this
// phase." When the OPPONENT's Karis dies in a puzzle, P2 answers for themselves. QA specified the
// target priority:
//
//   1. ready units first
//   2. then units in an arena where P2 has no Sentinel
//   3. then the highest power
//
// Deliberately NOT "whatever this kills": a unit with a When Defeated ability can be worth more to
// the solver dead than alive, so chasing a kill could hand them the puzzle.

type U = { cardId: string; ready?: boolean; damage?: number };

function arena(units: U[], owner: 1 | 2) {
  return units.map(u => ({
    cardId: u.cardId, playId: "@", owner, controller: owner,
    ready: u.ready ?? true, damage: u.damage ?? 0, upgrades: [], captives: [],
  }));
}

/** P1 holds Vanquish (SOR_078) to kill P2's Karis; P2 holds the Force token to pay for her. */
function newCtx(p1: { ground?: U[]; space?: U[] }, p2: { ground?: U[]; space?: U[] }): EngineContext {
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_020", damage: 0, epicActionUsed: false },
      leader: { cardId: "SOR_005", ready: true, deployed: false, epicActionUsed: false },
      groundArena: arena(p1.ground ?? [], 1),
      spaceArena: arena(p1.space ?? [], 1),
      resources: Array(12).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [], hand: [{ cardId: "SOR_078" }],
      supplemental: { creditTokens: 0, forceToken: true },
    },
    player2: {
      base: { cardId: "SOR_023", damage: 0, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: arena(p2.ground ?? [], 2),
      spaceArena: arena(p2.space ?? [], 2),
      resources: Array(3).fill(null).map(() => ({ cardId: "LAW_174", playId: "@", owner: 2, controller: 2, ready: true })),
      discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: true },
    },
    currentEffects: [], triggerBag: [],
  };
  const game: Game = { id: randomUUID(), currentGameState: hydratePuzzleGame(raw as never), gameStateHistory: [], gameLog: [] };
  return { game, pending: null };
}

function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
  return processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
    ctx,
  );
}

/** Vanquish P2's Karis (always their first ground unit here) and let her trigger auto-resolve. */
function killKaris(ctx: EngineContext) {
  const played = dispatch(ctx, "play-card", { cardId: "SOR_078", fromZone: "Hand" });
  const karis = played.context.game.currentGameState.player2.groundArena[0];
  expect(karis.cardId).toBe("LOF_031");
  return dispatch(played.context, "choose-target", { targetPlayIds: [karis.playId] });
}

/** The playId Karis's –2/–2 landed on, or null if she never fired. */
function debuffedPlayId(gs: GameState): string | null {
  const mod = gs.currentEffects.find(e => e.cardId === PHASE_STAT_MOD && e.value === -2);
  return mod?.targetPlayId ?? null;
}

const idsOf = (units: { playId: string }[]) => units.map(u => u.playId);

describe("puzzle mode — opponent's Karis (LOF_031) auto-target", () => {
  it("never hands the decision to the solver", () => {
    const res = killKaris(newCtx({ ground: [{ cardId: "SOR_095" }] }, { ground: [{ cardId: "LOF_031" }] }));
    expect(res.response.resolutionNeeded).toBeFalsy();
  });

  it("uses the Force when the solver has a unit to debuff", () => {
    const res = killKaris(newCtx({ ground: [{ cardId: "SOR_095" }] }, { ground: [{ cardId: "LOF_031" }] }));
    const gs = res.context.game.currentGameState;

    expect(gs.player2.supplemental.forceToken).toBe(false);
    expect(debuffedPlayId(gs)).toBe(gs.player1.groundArena[0].playId);
  });

  it("step 1: a ready unit is chosen over a stronger exhausted one", () => {
    const res = killKaris(newCtx(
      { ground: [
        { cardId: "SOR_051", ready: false }, // Luke Skywalker 6/7 — exhausted
        { cardId: "SOR_095" },               // Battlefield Marine 3/3 — ready
      ] },
      { ground: [{ cardId: "LOF_031" }] },
    ));
    const gs = res.context.game.currentGameState;

    expect(debuffedPlayId(gs)).toBe(gs.player1.groundArena[1].playId); // the ready Marine
  });

  it("step 2: within the ready tier, an arena P2 does not guard beats one it does", () => {
    // P2's Vigilant Honor Guards (SOR_048, Sentinel while undamaged) hold the ground arena, so the
    // solver's ground units must swing into them anyway — the space unit is the real threat.
    const res = killKaris(newCtx(
      { ground: [{ cardId: "SOR_051" }], space: [{ cardId: "LOF_119" }] }, // 6/7 ground vs a 4/10 space
      { ground: [{ cardId: "LOF_031" }, { cardId: "SOR_048" }] },
    ));
    const gs = res.context.game.currentGameState;

    expect(debuffedPlayId(gs)).toBe(gs.player1.spaceArena[0].playId);
  });

  it("control: with no P2 Sentinel anywhere, step 3 picks the stronger unit instead", () => {
    // Same board as above minus the Honor Guards — now nothing outranks raw power.
    const res = killKaris(newCtx(
      { ground: [{ cardId: "SOR_051" }], space: [{ cardId: "LOF_119" }] },
      { ground: [{ cardId: "LOF_031" }] },
    ));
    const gs = res.context.game.currentGameState;

    expect(debuffedPlayId(gs)).toBe(gs.player1.groundArena[0].playId); // the 6/7
  });

  it("step 3: readiness and guard status tied, the highest power wins", () => {
    const res = killKaris(newCtx(
      { ground: [{ cardId: "SOR_095" }, { cardId: "SOR_051" }] }, // 3/3 then 6/7, both ready
      { ground: [{ cardId: "LOF_031" }] },
    ));
    const gs = res.context.game.currentGameState;

    expect(debuffedPlayId(gs)).toBe(gs.player1.groundArena[1].playId);
  });

  it("declines when the solver controls no units — the Force is kept, not spent on P2's own unit", () => {
    const res = killKaris(newCtx({}, { ground: [{ cardId: "LOF_031" }, { cardId: "SOR_095" }] }));
    const gs = res.context.game.currentGameState;

    expect(gs.player2.supplemental.forceToken).toBe(true);
    expect(debuffedPlayId(gs)).toBeNull();
    expect(res.response.resolutionNeeded).toBeFalsy();
  });

  it("never debuffs one of P2's own units even though Karis may target any unit", () => {
    const res = killKaris(newCtx(
      { ground: [{ cardId: "SOR_095" }] },
      { ground: [{ cardId: "LOF_031" }, { cardId: "SOR_051" }] }, // P2's 6/7 outpowers the solver's 3/3
    ));
    const gs = res.context.game.currentGameState;

    expect(idsOf(gs.player2.groundArena)).not.toContain(debuffedPlayId(gs));
    expect(debuffedPlayId(gs)).toBe(gs.player1.groundArena[0].playId);
  });

  it("skips the ability entirely when P2 has no Force token", () => {
    const ctx = newCtx({ ground: [{ cardId: "SOR_095" }] }, { ground: [{ cardId: "LOF_031" }] });
    ctx.game.currentGameState.player2.supplemental.forceToken = false;

    const res = killKaris(ctx);
    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(debuffedPlayId(res.context.game.currentGameState)).toBeNull();
  });
});
