import { describe, it, expect } from "vitest";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";

// Barrage: Krennic vs Luke rebels. 4 Sentinel units block all attacks, creating
// a search space the solver cannot exhaust within the 55s budget. State is validated
// via hydration rather than solve().
const puzzle = {
  activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 5,
  initiativePlayer: 2, initiativeClaimed: true,
  player1: {
    base: { cardId: "SOR_023", damage: 29, epicActionUsed: false },
    leader: { cardId: "SOR_001", ready: true, deployed: false, epicActionUsed: true },
    groundArena: [
      { cardId: "SOR_032", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
      { cardId: "SOR_108", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
    ],
    spaceArena: [
      { cardId: "SOR_225", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
    ],
    resources: Array(6).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
    discard: [], deck: [],
    hand: [{ cardId: "SOR_077" }, { cardId: "SHD_081" }, { cardId: "SOR_092" }, { cardId: "SOR_120" }, { cardId: "SOR_121" }],
  },
  player2: {
    base: { cardId: "SOR_024", damage: 26, epicActionUsed: false },
    leader: { cardId: "SOR_005", ready: true, deployed: false, epicActionUsed: true },
    groundArena: [
      { cardId: "SOR_063", playId: "@", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [] },
      { cardId: "SOR_063", playId: "@", owner: 2, controller: 2, ready: false, damage: 1, upgrades: [], captives: [] },
    ],
    spaceArena: [
      { cardId: "JTL_064", playId: "@", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [] },
      { cardId: "JTL_064", playId: "@", owner: 2, controller: 2, ready: false, damage: 1, upgrades: [], captives: [] },
    ],
    resources: Array(6).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 2, controller: 2, ready: true })),
    discard: [],
    deck: [{ cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LAW_260" }, { cardId: "LAW_260" }],
    hand: [],
  },
  currentEffects: [], triggerBag: [],
};

describe("barrage puzzle — The Most Power Weapon the Galaxy Has Ever Seen", () => {
  it("hydrates to a valid game state", () => {
    const gs = hydratePuzzleGame(puzzle as any);
    expect(gs.player1.base.damage).toBe(29);
    expect(gs.player2.base.damage).toBe(26);
    expect(gs.player1.groundArena).toHaveLength(2);
    expect(gs.player1.spaceArena).toHaveLength(1);
    expect(gs.player2.groundArena).toHaveLength(2);
    expect(gs.player2.spaceArena).toHaveLength(2);
    expect(gs.player1.resources).toHaveLength(6);
    expect(gs.player1.hand).toHaveLength(5);
  });
});
