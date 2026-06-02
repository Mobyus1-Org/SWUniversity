import { describe, it, expect } from "vitest";
import { solve } from "@/server/puzzle/solver";

const puzzle = {
  activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 7,
  initiativePlayer: 2, initiativeClaimed: true,
  player1: {
    base: { cardId: "SOR_023", damage: 29, epicActionUsed: false },
    leader: { cardId: "SOR_016", ready: true, deployed: false, epicActionUsed: true },
    groundArena: [
      { cardId: "TWI_114", playId: "@", owner: 1, controller: 1, ready: false, damage: 1, upgrades: [], captives: [] },
      { cardId: "SHD_236", playId: "@", owner: 1, controller: 1, ready: false, damage: 2, upgrades: [], captives: [] },
    ],
    spaceArena: [
      { cardId: "SOR_231", playId: "@", owner: 1, controller: 1, ready: false, damage: 2, upgrades: [], captives: [] },
    ],
    resources: Array(8).fill(null).map(() => ({ cardId: "LAW_065", playId: "@", owner: 1, controller: 1, ready: true })),
    discard: [], deck: [],
    hand: [{ cardId: "SEC_184" }, { cardId: "SOR_252" }, { cardId: "SHD_223" }, { cardId: "SOR_219" }, { cardId: "SOR_222" }, { cardId: "SOR_087" }],
  },
  player2: {
    base: { cardId: "SOR_027", damage: 17, epicActionUsed: false },
    leader: { cardId: "SOR_009", ready: true, deployed: false, epicActionUsed: true },
    groundArena: [
      { cardId: "SOR_095", playId: "@", owner: 2, controller: 2, ready: false, damage: 2, upgrades: [], captives: [] },
    ],
    spaceArena: [
      { cardId: "SOR_141", playId: "@", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [] },
      { cardId: "SOR_144", playId: "@", owner: 2, controller: 2, ready: false, damage: 2, upgrades: [], captives: [] },
    ],
    resources: Array(6).fill(null).map(() => ({ cardId: "SOR_095", playId: "@", owner: 2, controller: 2, ready: true })),
    discard: [],
    deck: [{ cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LAW_260" }, { cardId: "LAW_260" }],
    hand: [],
  },
  currentEffects: [], triggerBag: [],
};

describe("thrawn-leia puzzle — Long Live the Empire", () => {
  it("is solvable", { timeout: 120_000 }, () => {
    const result = solve(puzzle as any);
    console.log("solvable:", result.solvable, "solutions:", result.steps.length, "timedOut:", result.timedOut);
    expect(result.solvable).toBe(true);
  });
});
