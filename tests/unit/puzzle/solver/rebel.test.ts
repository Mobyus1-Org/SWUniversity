import { describe, it, expect } from "vitest";
import { solve } from "@/server/puzzle/solver";
import { RunPuzzleSolver } from "../flags";

const puzzle = {
  activePlayer: 1, gamePhase: 0, currentRound: 7,
  initiativePlayer: 2, initiativeClaimed: true,
  player1: {
    base: { cardId: "SOR_022", epicActionUsed: false, damage: 23, numUses: 0 },
    leader: { cardId: "SOR_014", epicActionUsed: false, ready: true, deployed: false },
    groundArena: [
      { cardId: "SOR_145", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
      { cardId: "SHD_160", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
    ],
    spaceArena: [],
    resources: [
      { cardId: "SOR_141", playId: "@", owner: 1, controller: 1, ready: true },
      { cardId: "SOR_141", playId: "@", owner: 1, controller: 1, ready: true },
      { cardId: "SHD_153", playId: "@", owner: 1, controller: 1, ready: true },
      { cardId: "SHD_153", playId: "@", owner: 1, controller: 1, ready: true },
      { cardId: "SHD_153", playId: "@", owner: 1, controller: 1, ready: true },
      { cardId: "SHD_160", playId: "@", owner: 1, controller: 1, ready: true },
      { cardId: "JTL_100", playId: "@", owner: 1, controller: 1, ready: true },
      { cardId: "JTL_100", playId: "@", owner: 1, controller: 1, ready: true },
    ],
    discard: [], deck: [],
    hand: [{ cardId: "JTL_153" }, { cardId: "SOR_168" }, { cardId: "SOR_103" }, { cardId: "SOR_141" }, { cardId: "SOR_150" }],
    supplemental: {},
  },
  player2: {
    base: { cardId: "SOR_025", epicActionUsed: false, damage: 11, numUses: 0 },
    leader: { cardId: "SHD_014", epicActionUsed: true, ready: true, deployed: false },
    groundArena: [
      { cardId: "SOR_211", playId: "@", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [] },
      { cardId: "TWI_187", playId: "@", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [] },
    ],
    spaceArena: [],
    resources: [],
    discard: [],
    deck: [{ cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LAW_260" }, { cardId: "LAW_260" }],
    hand: [],
    supplemental: {},
  },
  currentEffects: [], triggerBag: [],
};

describe("rebel puzzle — A Rebel Assault", () => {
  it("is solvable", { timeout: 120_000 }, () => {
    if (!RunPuzzleSolver) {
      console.warn("Skipping puzzle solver test — set RunPuzzleSolver to true to enable");
      return;
    }
    const result = solve(puzzle as any, 115_000);
    console.log("solvable:", result.solvable, "solutions:", result.steps.length, "timedOut:", result.timedOut);
    expect(result.solvable).toBe(true);
  });
});
