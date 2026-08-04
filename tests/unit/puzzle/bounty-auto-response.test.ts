import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// A bounty is collected by the OPPONENT of the bountied unit's controller. So whenever the solver
// defeats one of their own units carrying a bounty — or attacks with it and loses it to counter
// damage — the collection decision belongs to P2.
//
// Nothing was mapped for it, so the fail-fast guard threw "Puzzle Auto Target not set" and the
// board appeared to lock up. QA hit this via Guild Target, but it was every bounty card.

type Upg = { cardId: string; playId: string; owner: number; controller: number };

function newCtx(p1Upgrades: Upg[]): EngineContext {
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_020", damage: 0, epicActionUsed: false },
      leader: { cardId: "SOR_005", ready: true, deployed: false, epicActionUsed: false },
      // Battlefield Marine 3/3 wearing the bounty, played on it by the opponent.
      groundArena: [{
        cardId: "SOR_095", playId: "@", owner: 1, controller: 1, ready: true, damage: 0,
        upgrades: p1Upgrades, captives: [],
      }],
      spaceArena: [],
      resources: Array(6).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: "SOR_023", damage: 0, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      // Wampa 4/5 — kills the Marine on the counter-swing.
      groundArena: [{ cardId: "SOR_164", playId: "@", owner: 2, controller: 2, ready: true, damage: 0, upgrades: [], captives: [] }],
      spaceArena: [],
      resources: [], discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };
  const gs = hydratePuzzleGame(raw as never);
  return { game: { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] } as Game, pending: null };
}

const upgrade = (cardId: string): Upg => ({ cardId, playId: "@", owner: 2, controller: 2 });

/** The solver attacks with their bountied Marine into the Wampa and loses it. */
function attackAndDie(ctx: EngineContext) {
  const gs = ctx.game.currentGameState;
  const atk = gs.player1.groundArena[0].playId;
  const def = gs.player2.groundArena[0].playId;
  const r1 = processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: "initiate-attack" as never, dispatchData: { playId: atk } as never, fromPlayer: 1 },
    ctx,
  );
  return processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: "choose-target" as never, dispatchData: { targetPlayIds: [def] } as never, fromPlayer: 1 },
    r1.context,
  );
}

describe("puzzle mode — the opponent collects bounties automatically", () => {
  it("SHD_173 Guild Target no longer throws, and hits the solver's base for 2", () => {
    const ctx = newCtx([upgrade("SHD_173")]);

    const res = attackAndDie(ctx);

    const end = res.context.game.currentGameState;
    expect(end.player1.groundArena).toHaveLength(0); // the Marine died
    expect(end.player1.base.damage).toBe(2);         // non-unique host → 2
    expect(res.response.resolutionNeeded).toBeFalsy(); // never handed to the solver
  });

  it("SHD_221 Wanted resolves silently too — the gap was every bounty, not just Guild Target", () => {
    const ctx = newCtx([upgrade("SHD_221")]);
    ctx.game.currentGameState.player2.resources = [
      { cardId: "LAW_174", playId: "r1", owner: 2, controller: 2, ready: false },
      { cardId: "LAW_174", playId: "r2", owner: 2, controller: 2, ready: false },
    ] as never;

    const res = attackAndDie(ctx);

    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(res.context.game.currentGameState.player2.resources.filter(r => r.ready)).toHaveLength(2);
  });

  it("SHD_068 Public Enemy puts its Shield on one of P2's own units", () => {
    const ctx = newCtx([upgrade("SHD_068")]);

    const res = attackAndDie(ctx);

    expect(res.response.resolutionNeeded).toBeFalsy();
    const wampa = res.context.game.currentGameState.player2.groundArena[0];
    expect(wampa.upgrades.some(u => u.cardId === "SOR_T02")).toBe(true);
  });

  it("control: an unbountied unit dying prompts nothing at all", () => {
    const ctx = newCtx([]);

    const res = attackAndDie(ctx);

    expect(res.context.game.currentGameState.player1.groundArena).toHaveLength(0);
    expect(res.context.game.currentGameState.player1.base.damage).toBe(0);
    expect(res.response.resolutionNeeded).toBeFalsy();
  });
});
