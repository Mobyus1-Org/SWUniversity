import { describe, it, expect } from "vitest";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";

// Mandlore: Bo-Katan vs Gar Saxon. Opponent has a heavily upgraded Gar Saxon
// with 5 upgrades. The resulting search space exceeds the solver's 55s budget.
// State is validated via hydration rather than solve().
const puzzle = {
  activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 8,
  initiativePlayer: 2, initiativeClaimed: true,
  player1: {
    base: { cardId: "TWI_020", damage: 29, epicActionUsed: false },
    leader: { cardId: "SHD_012", ready: true, deployed: false, epicActionUsed: false },
    groundArena: [
      { cardId: "SHD_056", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
      { cardId: "SHD_147", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
      { cardId: "SHD_169", playId: "@", owner: 1, controller: 1, ready: true, damage: 4, upgrades: [], captives: [] },
    ],
    spaceArena: [],
    resources: Array(7).fill(null).map(() => ({ cardId: "SHD_056", playId: "@", owner: 1, controller: 1, ready: true })),
    discard: [], deck: [],
    hand: [{ cardId: "SHD_073" }, { cardId: "SHD_166" }, { cardId: "SOR_072" }, { cardId: "SOR_077" }, { cardId: "SHD_126" }, { cardId: "SHD_177" }],
  },
  player2: {
    base: { cardId: "SHD_026", damage: 15, epicActionUsed: false },
    leader: { cardId: "SHD_001", ready: true, deployed: false, epicActionUsed: true },
    groundArena: [
      {
        cardId: "SHD_034", playId: "@", owner: 2, controller: 2, ready: true, damage: 0, captives: [],
        upgrades: [
          { cardId: "SHD_073", playId: "@", owner: 2, controller: 2 },
          { cardId: "SHD_073", playId: "@", owner: 2, controller: 2 },
          { cardId: "SOR_T02", playId: "@", owner: 2, controller: 2 },
          { cardId: "SOR_T02", playId: "@", owner: 2, controller: 2 },
          { cardId: "SOR_T02", playId: "@", owner: 2, controller: 2 },
        ],
      },
      { cardId: "SHD_028", playId: "@", owner: 2, controller: 2, ready: true, damage: 3, upgrades: [], captives: [] },
    ],
    spaceArena: [
      { cardId: "SHD_035", playId: "@", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [] },
    ],
    resources: [],
    discard: [],
    deck: [{ cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LAW_260" }, { cardId: "LAW_260" }],
    hand: [],
  },
  currentEffects: [], triggerBag: [],
};

describe("mandlore puzzle — The Fight for Mandalore", () => {
  it("hydrates to a valid game state", () => {
    const gs = hydratePuzzleGame(puzzle as any);
    expect(gs.player1.base.damage).toBe(29);
    expect(gs.player2.base.damage).toBe(15);
    expect(gs.player1.groundArena).toHaveLength(3);
    expect(gs.player2.groundArena).toHaveLength(2);
    expect(gs.player2.groundArena[0].upgrades).toHaveLength(5);
    expect(gs.player1.resources).toHaveLength(7);
    expect(gs.player1.hand).toHaveLength(6);
  });
});
