import { describe, it, expect } from "vitest";
import { solve } from "@/server/puzzle/solver";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";

// Minimal solvable puzzle: P1 has one ready unit (Battlefield Marine, 2 power),
// P2's base has 28/30 HP — one unblocked attack wins.
// SOR_026 (Catacombs of Cadera) has 30 HP. Both decks have 2 cards so the
// empty-deck penalty (6 dmg/round) does not fire when passing, ensuring that
// the only winning line is the attack.
const triviallyWinnablePuzzle: RawPuzzleGameState = {
  activePlayer: 1,
  gamePhase: 0,
  currentRound: 7,
  initiativePlayer: 2,
  initiativeClaimed: true,
  player1: {
    base: { cardId: "SOR_022", damage: 0, epicActionUsed: false },
    leader: { cardId: "SOR_014", ready: false, deployed: false, epicActionUsed: true },
    groundArena: [
      { cardId: "SOR_095", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
    ],
    spaceArena: [],
    resources: [],
    discard: [],
    deck: [{ cardId: "SOR_095" }, { cardId: "SOR_095" }],
    hand: [],
  },
  player2: {
    base: { cardId: "SOR_026", damage: 28, epicActionUsed: true },
    leader: { cardId: "SHD_014", ready: false, deployed: false, epicActionUsed: true },
    groundArena: [],
    spaceArena: [],
    resources: [],
    discard: [],
    deck: [{ cardId: "SOR_095" }, { cardId: "SOR_095" }],
    hand: [],
  },
  currentEffects: [],
  triggerBag: [],
};

// Unsolvable: P1 has no units, no hand, no abilities — can only pass.
// Decks are non-empty so round-end empty-deck damage does not accumulate.
const unsolvablePuzzle: RawPuzzleGameState = {
  activePlayer: 1,
  gamePhase: 0,
  currentRound: 7,
  initiativePlayer: 2,
  initiativeClaimed: true,
  player1: {
    base: { cardId: "SOR_022", damage: 0, epicActionUsed: false },
    leader: { cardId: "SOR_014", ready: false, deployed: false, epicActionUsed: true },
    groundArena: [],
    spaceArena: [],
    resources: [],
    discard: [],
    deck: [{ cardId: "SOR_095" }, { cardId: "SOR_095" }],
    hand: [],
  },
  player2: {
    base: { cardId: "SOR_026", damage: 0, epicActionUsed: true },
    leader: { cardId: "SHD_014", ready: false, deployed: false, epicActionUsed: true },
    groundArena: [],
    spaceArena: [],
    resources: [],
    discard: [],
    deck: [{ cardId: "SOR_095" }, { cardId: "SOR_095" }],
    hand: [],
  },
  currentEffects: [],
  triggerBag: [],
};

describe("solve", () => {
  it("returns solvable: true with steps for a trivially winnable puzzle", () => {
    const result = solve(triviallyWinnablePuzzle);

    expect(result.solvable).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
    // Every solution should contain an attack step
    for (const path of result.steps) {
      expect(path.some(s => s.includes("Attack with"))).toBe(true);
    }
  });

  it("returns solvable: false for a puzzle with no winning line", () => {
    const result = solve(unsolvablePuzzle);

    expect(result.solvable).toBe(false);
    expect(result.steps).toHaveLength(0);
  });

  it("deduplicates solutions that share the same steps regardless of order", () => {
    const result = solve(triviallyWinnablePuzzle);

    // Verify no two entries in steps are identical when sorted
    const keys = result.steps.map(path => JSON.stringify([...path].sort()));
    const unique = new Set(keys);
    expect(unique.size).toBe(result.steps.length);
  });

  it("never includes timedOut on fast puzzles", () => {
    const result = solve(triviallyWinnablePuzzle);
    expect(result.timedOut).toBeUndefined();
  });
});
