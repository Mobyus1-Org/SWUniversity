import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { solve } from "@/server/puzzle/solver";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import type { GameState } from "@/lib/engine/game";
import {
  asWinCondition,
  puzzleOutcome,
  lossExplanation,
  winConditionSetupError,
} from "@/util/puzzle-win-condition";
import { Cards } from "../../card-helpers";

// A puzzle's goal decides what "won" means. Find Lethal (the original, and the default for every
// puzzle saved before goals existed) wins on the opponent's base. The others win on a board state
// — checked only once nothing is left to resolve, and only inside the single action phase a puzzle
// is played in. Ending the game any other way (lethal in a Clear the Board puzzle, say) is simply a
// failed puzzle.

const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground
const RESTORE_2 = Cards.units.ash.remnantOfficial; // 3/3 Ground, Restore 2

function board(opts: { myBaseDamage?: number; theirUnit?: boolean } = {}): GameState {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, opts.myBaseDamage ?? 0)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE);
  if (opts.theirUnit !== false) b = b.WithGroundUnitForPlayer(2, MARINE);
  return b.Build();
}

function withDefeated(gs: GameState, ...players: Array<1 | 2>): GameState {
  return { ...gs, defeatedPlayers: players };
}

describe("asWinCondition", () => {
  it("defaults a missing or unknown value to deal-lethal", () => {
    expect(asWinCondition(undefined)).toBe("deal-lethal");
    expect(asWinCondition("")).toBe("deal-lethal");
    expect(asWinCondition("win-by-vibes")).toBe("deal-lethal");
  });

  it("keeps every known id", () => {
    for (const id of ["deal-lethal", "clear-board", "heal-full", "self-lethal"]) {
      expect(asWinCondition(id)).toBe(id);
    }
  });
});

describe("deal-lethal (unchanged behavior)", () => {
  it("wins on the opponent's base, loses on yours, draws on both", () => {
    const gs = board();
    expect(puzzleOutcome(withDefeated(gs, 2), "deal-lethal")).toBe("won");
    expect(puzzleOutcome(withDefeated(gs, 1), "deal-lethal")).toBe("lost");
    expect(puzzleOutcome(withDefeated(gs, 1, 2), "deal-lethal")).toBe("draw");
    expect(puzzleOutcome(gs, "deal-lethal")).toBe("playing");
  });

  it("an empty enemy board is not a win", () => {
    expect(puzzleOutcome(board({ theirUnit: false }), "deal-lethal")).toBe("playing");
  });

  it("reaching the regroup resource step fails the puzzle", () => {
    expect(puzzleOutcome({ ...board(), gamePhase: "RegroupResource" }, "deal-lethal")).toBe("failed-regroup");
  });
});

describe("clear-board", () => {
  it("is still playing while any enemy unit remains", () => {
    expect(puzzleOutcome(board(), "clear-board")).toBe("playing");
  });

  it("wins once the opponent has no units in either arena", () => {
    expect(puzzleOutcome(board({ theirUnit: false }), "clear-board")).toBe("won");
  });

  it("an enemy SPACE unit still counts", () => {
    const gs = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(2, Cards.units.shd.razorCrest)
      .Build();
    expect(puzzleOutcome(gs, "clear-board")).toBe("playing");
  });

  it("waits while a prompt is open — a When Defeated could still put a unit back", () => {
    expect(puzzleOutcome(board({ theirUnit: false }), "clear-board", true)).toBe("playing");
  });

  it("does not win outside the action phase", () => {
    const gs = { ...board({ theirUnit: false }), gamePhase: "RegroupResource" as const };
    expect(puzzleOutcome(gs, "clear-board")).toBe("failed-regroup");
  });

  it("destroying the opponent's base instead fails the puzzle", () => {
    expect(puzzleOutcome(withDefeated(board(), 2), "clear-board")).toBe("lost");
  });

  it("losing your own base is a plain loss", () => {
    expect(puzzleOutcome(withDefeated(board(), 1), "clear-board")).toBe("lost");
    expect(puzzleOutcome(withDefeated(board(), 1, 2), "clear-board")).toBe("lost");
  });
});

describe("heal-full", () => {
  it("is still playing while your base has damage", () => {
    expect(puzzleOutcome(board({ myBaseDamage: 4 }), "heal-full")).toBe("playing");
  });

  it("wins once your base has no damage", () => {
    expect(puzzleOutcome(board({ myBaseDamage: 0 }), "heal-full")).toBe("won");
  });

  it("waits while a prompt is open", () => {
    expect(puzzleOutcome(board({ myBaseDamage: 0 }), "heal-full", true)).toBe("playing");
  });

  it("destroying the opponent's base instead fails the puzzle", () => {
    expect(puzzleOutcome(withDefeated(board({ myBaseDamage: 4 }), 2), "heal-full")).toBe("lost");
  });

  it("losing your own base is a plain loss", () => {
    expect(puzzleOutcome(withDefeated(board({ myBaseDamage: 4 }), 1), "heal-full")).toBe("lost");
  });
});

describe("self-lethal", () => {
  it("wins when your own base is defeated in the action phase", () => {
    expect(puzzleOutcome(withDefeated(board(), 1), "self-lethal")).toBe("won");
  });

  it("is still playing while your base stands", () => {
    expect(puzzleOutcome(board(), "self-lethal")).toBe("playing");
  });

  it("taking both bases down fails the puzzle", () => {
    expect(puzzleOutcome(withDefeated(board(), 1, 2), "self-lethal")).toBe("lost");
  });

  it("destroying only the opponent's base fails the puzzle", () => {
    expect(puzzleOutcome(withDefeated(board(), 2), "self-lethal")).toBe("lost");
  });

  it("dying to the regroup draw fails the puzzle, not a win (only the action phase counts)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 27)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInDeckForPlayer(2, MARINE)
        .WithCardInDeckForPlayer(2, MARINE)
        .Build(),
    );

    // Both pass: the empty deck's regroup draws deal 6 to a base with 3 HP left.
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.defeatedPlayers).toEqual([1]);
    expect(puzzleOutcome(g.state, "deal-lethal")).toBe("lost");
    expect(puzzleOutcome(g.state, "self-lethal")).toBe("lost");
  });
});

describe("lossExplanation", () => {
  it("is the usual copy when your own base fell", () => {
    expect(lossExplanation(withDefeated(board(), 1), "deal-lethal")).toMatch(/your base was defeated/i);
    expect(lossExplanation(withDefeated(board(), 1), "clear-board")).toMatch(/your base was defeated/i);
  });

  it("names the goal when the opponent's base fell instead", () => {
    const text = lossExplanation(withDefeated(board(), 2), "clear-board");
    expect(text).toMatch(/opponent's base/i);
    expect(text).toMatch(/every unit/i);
    expect(text).not.toMatch(/Discord/);
  });

  it("explains a double defeat on self-lethal", () => {
    expect(lossExplanation(withDefeated(board(), 1, 2), "self-lethal")).toMatch(/both bases/i);
  });

  it("explains a regroup-phase self defeat", () => {
    const gs = { ...withDefeated(board(), 1), gamePhase: "RegroupDraw" as const };
    expect(lossExplanation(gs, "self-lethal")).toMatch(/action phase/i);
  });
});

describe("winConditionSetupError", () => {
  it("rejects clear-board when the opponent starts with no units", () => {
    expect(winConditionSetupError(board({ theirUnit: false }), "clear-board")).toMatch(/unit/i);
    expect(winConditionSetupError(board(), "clear-board")).toBeNull();
  });

  it("rejects heal-full when your base starts undamaged", () => {
    expect(winConditionSetupError(board({ myBaseDamage: 0 }), "heal-full")).toMatch(/damage/i);
    expect(winConditionSetupError(board({ myBaseDamage: 3 }), "heal-full")).toBeNull();
  });

  it("has nothing to say about the lethal goals", () => {
    expect(winConditionSetupError(board({ theirUnit: false }), "deal-lethal")).toBeNull();
    expect(winConditionSetupError(board(), "self-lethal")).toBeNull();
  });
});

// --- The validator (solver) has to agree with the client about what a win is. ---

function rawPuzzle(opts: { myBaseDamage: number; myUnit: string; theirUnitDamage: number }): RawPuzzleGameState {
  const unit = (cardId: string, owner: 1 | 2, damage: number) =>
    ({ cardId, playId: "@", owner, controller: owner, ready: true, damage, upgrades: [], captives: [] });
  return {
    activePlayer: 1,
    gamePhase: 0,
    currentRound: 7,
    initiativePlayer: 2,
    initiativeClaimed: true,
    player1: {
      base: { cardId: Cards.bases.common.green30HP, damage: opts.myBaseDamage, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: false, deployed: false, epicActionUsed: true },
      groundArena: [unit(opts.myUnit, 1, 0)],
      spaceArena: [],
      resources: [],
      discard: [],
      deck: [{ cardId: MARINE }, { cardId: MARINE }],
      hand: [],
    },
    player2: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: true },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: false, deployed: false, epicActionUsed: true },
      groundArena: [unit(MARINE, 2, opts.theirUnitDamage)],
      spaceArena: [],
      resources: [],
      discard: [],
      deck: [{ cardId: MARINE }, { cardId: MARINE }],
      hand: [],
    },
    currentEffects: [],
    triggerBag: [],
  } as RawPuzzleGameState;
}

describe("solve() honours the win condition", () => {
  it("clear-board: attacking the lone enemy unit is a solution; the same board has no lethal", () => {
    const puzzle = rawPuzzle({ myBaseDamage: 0, myUnit: MARINE, theirUnitDamage: 2 });
    expect(solve(puzzle, 20_000, "clear-board").solvable).toBe(true);
    expect(solve(puzzle, 20_000, "deal-lethal").solvable).toBe(false);
  });

  it("heal-full: a Restore 2 attack heals a 2-damage base to full", () => {
    expect(solve(rawPuzzle({ myBaseDamage: 2, myUnit: RESTORE_2, theirUnitDamage: 0 }), 20_000, "heal-full").solvable).toBe(true);
    expect(solve(rawPuzzle({ myBaseDamage: 3, myUnit: RESTORE_2, theirUnitDamage: 0 }), 20_000, "heal-full").solvable).toBe(false);
  });

  it("defaults to deal-lethal", () => {
    expect(solve(rawPuzzle({ myBaseDamage: 0, myUnit: MARINE, theirUnitDamage: 2 })).solvable).toBe(false);
  });
});
