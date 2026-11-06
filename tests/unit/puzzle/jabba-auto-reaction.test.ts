import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// SEC_002 Jabba the Hutt deployed on Player 2's side: when the solver's attack damages a P2 unit and
// it survives, "you may have that unit deal that much damage to an enemy unit". In a puzzle P2 is
// automated — it always takes it, and the solver is never asked.

const JABBA = Cards.leaders.sec.jabbaTheHutt;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3
const CONSULAR = Cards.units.sor.consularSecurityForce; // 3/7
const TURTLE = Cards.units.ash.dinosaurTurtle;          // 7/7

function newCtx(): EngineContext {
  const unit = (cardId: string, playId: string, player: 1 | 2) =>
    ({ cardId, playId, owner: player, controller: player, ready: true, damage: 0, upgrades: [], captives: [] });
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 100, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: true, deployed: false, epicActionUsed: false },
      groundArena: [unit(MARINE, "10", 1), unit(CONSULAR, "11", 1)],
      spaceArena: [], resources: [], discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: JABBA, ready: true, deployed: true, epicActionUsed: true, deployedPlayId: "20" },
      groundArena: [unit(JABBA, "20", 2), unit(TURTLE, "21", 2)],
      spaceArena: [], resources: [], discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };
  const gs = hydratePuzzleGame(raw as never);
  const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
  return { game, pending: null };
}

function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
  return processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
    ctx,
  );
}

describe("SEC_002 Jabba the Hutt — P2's reaction is automated in puzzles", () => {
  it("the surviving P2 unit deals the damage it took to a solver unit, unasked", () => {
    const ctx = newCtx();
    const declared = dispatch(ctx, "initiate-attack", { playId: "10" });
    const res = dispatch(declared.context, "choose-target", { targetPlayIds: ["21"] });

    expect(res.response.resolutionNeeded).toBeFalsy();
    const p1 = res.context.game.currentGameState.player1.groundArena;
    expect(p1.map(u => u.cardId)).toEqual([CONSULAR]); // the Marine died in combat
    expect(p1[0].damage).toBe(3);                       // the Turtle's 3, sent back
  });
});
