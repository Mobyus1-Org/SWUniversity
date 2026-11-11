import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";
import type { ResolutionRequest } from "@/lib/engine/message-types";
import { puzzleOutcome } from "@/util/puzzle-win-condition";
import { Cards } from "../../card-helpers";

// Clear the Board is judged only once every pending ability has finished resolving and the game is
// waiting on the player's next action. The opponent's lone SEC_148 Karis Nemik is the reference
// case: when she dies the board is momentarily empty, but her When Defeated ("You may disclose
// Aggression + Heroism. If you do, create a Spy token and ready it.") can still put a unit back.
// With red + white in the opponent's hand that Spy arrives and the puzzle is NOT won.
//
// Each step below is judged exactly as the client judges it: the state and open prompt in the
// response to every dispatch.

const KARIS = Cards.units.sec.karisNemik; // Aggression + Heroism herself
const VANQUISH = Cards.events.sor.vanquish;

function newCtx(p2Hand: string[]): EngineContext {
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 2, initiativeClaimed: true,
    player1: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: false, deployed: false, epicActionUsed: true },
      groundArena: [], spaceArena: [],
      resources: Array(12).fill(null).map(() => ({ cardId: Cards.units.sor.battlefieldMarine, playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [{ cardId: Cards.units.sor.battlefieldMarine }, { cardId: Cards.units.sor.battlefieldMarine }],
      hand: [{ cardId: VANQUISH }],
    },
    player2: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: true },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: false, deployed: false, epicActionUsed: true },
      groundArena: [{ cardId: KARIS, playId: "@", owner: 2, controller: 2, ready: true, damage: 0, upgrades: [], captives: [] }],
      spaceArena: [], resources: [], discard: [],
      deck: [{ cardId: Cards.units.sor.battlefieldMarine }, { cardId: Cards.units.sor.battlefieldMarine }],
      hand: p2Hand.map(cardId => ({ cardId })),
    },
    currentEffects: [], triggerBag: [],
  };
  const game: Game = { id: randomUUID(), currentGameState: hydratePuzzleGame(raw as never), gameStateHistory: [], gameLog: [] };
  return { game, pending: null };
}

function step(ctx: EngineContext, type: string, data: Record<string, unknown>) {
  const result = processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
    ctx,
  );
  expect(result.response.invalidAction).toBeFalsy();
  const prompt = (result.response.resolutionNeeded as ResolutionRequest | undefined) ?? null;
  return { ctx: result.context, gs: result.context.game.currentGameState, prompt };
}

/** Vanquish the opponent's Karis, judging Clear the Board after every response along the way. */
function vanquishKaris(p2Hand: string[]) {
  const outcomes: string[] = [];
  const played = step(newCtx(p2Hand), "play-card", { cardId: VANQUISH, fromZone: "Hand" });
  outcomes.push(puzzleOutcome(played.gs, "clear-board", played.prompt !== null));
  const karis = played.gs.player2.groundArena[0];
  expect(karis.cardId).toBe(KARIS);
  const after = step(played.ctx, "choose-target", { targetPlayIds: [karis.playId] });
  outcomes.push(puzzleOutcome(after.gs, "clear-board", after.prompt !== null));
  return { ...after, outcomes };
}

describe("Clear the Board waits for pending abilities (opponent's Karis Nemik)", () => {
  it("red + white in their hand: the Spy arrives, so the board is never judged clear", () => {
    const { gs, outcomes } = vanquishKaris([KARIS]);

    expect(gs.player2.groundArena.map(u => u.cardId)).toEqual([Cards.units.token.spy]);
    expect(outcomes).not.toContain("won");
    expect(outcomes.at(-1)).toBe("playing");
  });

  it("red + white split across two cards still discloses", () => {
    const { gs, outcomes } = vanquishKaris([Cards.events.sor.aggression, Cards.units.sor.battlefieldMarine]);

    expect(gs.player2.groundArena.map(u => u.cardId)).toEqual([Cards.units.token.spy]);
    expect(outcomes).not.toContain("won");
  });

  it("without red + white there is no Spy, and the cleared board wins", () => {
    const { gs, outcomes } = vanquishKaris([Cards.events.sor.vanquish]);

    expect(gs.player2.groundArena).toEqual([]);
    expect(outcomes.at(-1)).toBe("won");
  });
});
