import { describe, it, expect } from "vitest";
import { solve } from "@/server/puzzle/solver";

const puzzle = {
  activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
  initiativePlayer: 2, initiativeClaimed: true,
  player1: {
    base: { cardId: "SOR_022", damage: 24, epicActionUsed: false },
    leader: { cardId: "SHD_008", ready: true, deployed: false, epicActionUsed: true },
    groundArena: [
      { cardId: "SOR_098", playId: "@", owner: 1, controller: 1, ready: false, damage: 0, upgrades: [], captives: [] },
    ],
    spaceArena: [
      { cardId: "SHD_101", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
    ],
    resources: Array(8).fill(null).map(() => ({ cardId: "SOR_095", playId: "@", owner: 1, controller: 1, ready: true })),
    discard: [], deck: [],
    hand: [{ cardId: "SOR_094" }, { cardId: "SOR_103" }, { cardId: "SOR_095" }, { cardId: "SOR_106" }, { cardId: "SOR_127" }, { cardId: "SHD_132" }],
  },
  player2: {
    base: { cardId: "SOR_026", damage: 22, epicActionUsed: false },
    leader: { cardId: "SOR_009", ready: true, deployed: false, epicActionUsed: true },
    groundArena: [
      { cardId: "SOR_145", playId: "@", owner: 2, controller: 2, ready: false, damage: 3, upgrades: [], captives: [] },
    ],
    spaceArena: [],
    resources: Array(6).fill(null).map(() => ({ cardId: "SOR_095", playId: "@", owner: 2, controller: 2, ready: true })),
    discard: [],
    deck: [{ cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LAW_260" }, { cardId: "LAW_260" }],
    hand: [],
  },
  currentEffects: [], triggerBag: [],
};

describe("adelphi puzzle — Adelphi Delta", () => {
  it("is solvable", () => {
    const result = solve(puzzle as any);
    console.log("solvable:", result.solvable, "solutions:", result.steps.length, "timedOut:", result.timedOut);
    expect(result.solvable).toBe(true);
  });
});
