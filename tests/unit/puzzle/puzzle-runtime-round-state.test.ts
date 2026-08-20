import { describe, it, expect } from "vitest";
import { hydratePuzzleGame, type RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// No stored puzzle carries a `roundState` — the builder never writes one — so EVERY puzzle is
// hydrated from the fallback literal in puzzle-runtime.ts. A field missing from that literal is
// therefore missing in every puzzle at once.
//
// `cardsDrawnThisPhase` was one such field: MarkCardDrawn does
// `gs.roundState.cardsDrawnThisPhase[player] += count`, which threw
// "Cannot read properties of undefined" and surfaced to the player as the API's generic
// "Unable to process dispatch." That made every draw effect in every puzzle a hard error.
//
// TypeScript could not catch it: the old code was `(raw.roundState as T) ?? { ...literal }`, and
// pre-casting the left operand stops the literal from being checked against T.

/** A minimal stored puzzle, shaped like what the builder actually writes — no roundState. */
function rawPuzzle(overrides: Record<string, unknown> = {}): RawPuzzleGameState {
  const side = (leader: string, base: string) => ({
    base: { cardId: base, damage: 0, epicActionUsed: false },
    leader: { cardId: leader, ready: true, deployed: false, epicActionUsed: false },
    groundArena: [], spaceArena: [], resources: [], discard: [], deck: [], hand: [],
    supplemental: {},
  });
  return {
    activePlayer: 1,
    gamePhase: 1,
    currentRound: 1,
    initiativePlayer: 1,
    initiativeClaimed: true,
    player1: side(Cards.leaders.sor.sabineWren, Cards.bases.common.green30HP),
    player2: side(Cards.leaders.sor.sabineWren, Cards.bases.common.green30HP),
    ...overrides,
  } as unknown as RawPuzzleGameState;
}

describe("puzzle hydration — roundState defaults", () => {
  it("fills in every roundState field when the puzzle stores none", () => {
    const game = hydratePuzzleGame(rawPuzzle());
    const rs = game.roundState;

    expect(rs.cardsDrawnThisPhase).toEqual({ 1: 0, 2: 0 });
    expect(rs.cardsPlayedThisPhase).toEqual([]);
    expect(rs.cardsPlayedThisRound).toEqual([]);
    expect(rs.cardsEnteredPlayThisPhase).toEqual([]);
    expect(rs.cardsLeftPlayThisPhase).toEqual([]);
    expect(rs.unitsAttackedThisPhase).toEqual([]);
    expect(rs.baseDamagedThisPhase).toEqual([]);
    expect(rs.unitsDamagedThisPhase).toEqual([]);
    expect(rs.lastActionWasPass).toBe(false);
    expect(rs.regroupResourcedPlayers).toEqual([]);
    expect(rs.forceUsedThisPhase).toBe(0);
  });

  it("keeps a stored roundState's values while defaulting the fields it omits", () => {
    const game = hydratePuzzleGame(rawPuzzle({
      roundState: { forceUsedThisPhase: 3, unitsDamagedThisPhase: ["7"] },
    }));

    expect(game.roundState.forceUsedThisPhase).toBe(3);        // preserved
    expect(game.roundState.unitsDamagedThisPhase).toEqual(["7"]); // preserved
    expect(game.roundState.cardsDrawnThisPhase).toEqual({ 1: 0, 2: 0 }); // defaulted
    expect(game.roundState.cardsPlayedThisPhase).toEqual([]);            // defaulted
  });

  it("a draw effect resolves instead of throwing (SEC_232 Kreia's Whispers)", async () => {
    const raw = rawPuzzle();
    const p1 = (raw as unknown as { player1: Record<string, unknown> }).player1;
    p1.hand = [{ cardId: Cards.events.sec.kreiasWhispers }];
    p1.deck = [{ cardId: Cards.units.sor.battlefieldMarine }, { cardId: Cards.units.sor.battlefieldMarine }];
    p1.resources = Array.from({ length: 8 }, () => ({
      cardId: Cards.units.sor.battlefieldMarine, playId: "@", owner: 1, controller: 1, ready: true, stolen: false,
    }));

    const g = new GameTestAdapter();
    g.loadNewState(hydratePuzzleGame(raw));

    await g.playCardFromHandAsync(1, 0);

    // It drew what it could and reached its hand-pick prompt rather than blowing up.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    expect(g.state.roundState.cardsDrawnThisPhase[1]).toBe(2); // a 2-card deck
  });
});
