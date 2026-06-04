import { describe, it, expect } from "vitest";
import { solve } from "@/server/puzzle/solver";

const puzzle = {
  activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 8,
  initiativePlayer: 2, initiativeClaimed: true,
  player1: {
    base: { cardId: "JTL_020", damage: 27, epicActionUsed: false },
    leader: { cardId: "SOR_006", ready: true, deployed: false, epicActionUsed: false },
    groundArena: [
      { cardId: "TWI_113", playId: "@", owner: 1, controller: 1, ready: false, damage: 0, upgrades: [], captives: [] },
    ],
    spaceArena: [],
    resources: Array(10).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
    discard: [], deck: [],
    hand: [{ cardId: "SOR_127" }, { cardId: "SOR_087" }, { cardId: "SHD_085" }, { cardId: "SOR_122" }, { cardId: "SHD_129" }],
  },
  player2: {
    base: { cardId: "JTL_021", damage: 27, epicActionUsed: false },
    leader: { cardId: "SHD_004", ready: true, deployed: false, epicActionUsed: true },
    groundArena: [
      { cardId: "JTL_056", playId: "@", owner: 2, controller: 2, ready: true, damage: 0, upgrades: [], captives: [] },
      { cardId: "SHD_043", playId: "@", owner: 2, controller: 2, ready: true, damage: 0, captives: [],
        upgrades: [{ cardId: "SOR_T02", playId: "@", owner: 2, controller: 2 }] },
      { cardId: "SHD_041", playId: "@", owner: 2, controller: 2, ready: true, damage: 0, upgrades: [], captives: [] },
      { cardId: "TWI_044", playId: "@", owner: 2, controller: 2, ready: true, damage: 0, upgrades: [], captives: [] },
    ],
    spaceArena: [],
    resources: Array(8).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 2, controller: 2, ready: false })),
    discard: [],
    deck: [{ cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LAW_260" }, { cardId: "LAW_260" }],
    hand: [],
  },
  currentEffects: [], triggerBag: [],
};

describe("palp-rey puzzle — You Cannot Run From Your Name", () => {
  it("is solvable", { timeout: 120_000 }, () => {
    const result = solve(puzzle as any);
    console.log("solvable:", result.solvable, "solutions:", result.steps.length, "timedOut:", result.timedOut);
    expect(result.solvable).toBe(true);
  });
});
