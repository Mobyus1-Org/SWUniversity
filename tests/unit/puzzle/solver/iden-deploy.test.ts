import { describe, it, expect } from "vitest";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import { getTopLevelActions, getResolutionActions } from "@/server/puzzle/solver/actions";
import { randomUUID } from "crypto";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";
import type { ResolutionRequest } from "@/lib/engine/message-types";

const rawPuzzle = {
  activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
  initiativePlayer: 2, initiativeClaimed: true,
  player1: {
    base: { cardId: "SHD_019", damage: 14, epicActionUsed: false },
    leader: { cardId: "SOR_002", ready: true, deployed: false, epicActionUsed: false },
    groundArena: [
      { cardId: "SHD_028", playId: "@", owner: 1, controller: 1, ready: true, damage: 0, upgrades: [], captives: [] },
      { cardId: "SHD_188", playId: "@", owner: 1, controller: 1, ready: true, damage: 1, upgrades: [], captives: [] }
    ],
    spaceArena: [], resources: Array(10).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
    discard: [], deck: [],
    hand: [{ cardId: "SOR_031" }, { cardId: "SOR_036" }, { cardId: "SOR_077" }, { cardId: "SEC_239" }, { cardId: "SOR_201" }, { cardId: "SOR_200" }, { cardId: "SOR_052" }],
    supplemental: {}
  },
  player2: {
    base: { cardId: "SOR_029", damage: 22, epicActionUsed: false },
    leader: { cardId: "SOR_014", ready: true, deployed: false, epicActionUsed: false },
    groundArena: [
      { cardId: "TWI_141", playId: "@", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [] },
      { cardId: "TWI_141", playId: "@", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [] }
    ],
    spaceArena: [], resources: Array(6).fill(null).map(() => ({ cardId: "LAW_187", playId: "@", owner: 2, controller: 2, ready: false })),
    discard: [], deck: [{ cardId: "LAW_260" }, { cardId: "LAW_260" }, { cardId: "LOF_254" }, { cardId: "LOF_254" }, { cardId: "LOF_254" }],
    hand: [{ cardId: "LOF_254" }, { cardId: "SOR_141" }, { cardId: "JTL_096" }, { cardId: "SOR_200" }],
    supplemental: {}
  },
  currentEffects: [], triggerBag: []
};

describe("deploy trace", () => {
  it("traces exact winning sequence step by step in the DFS", () => {
    const gs = hydratePuzzleGame(rawPuzzle);
    const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
    const ctx: EngineContext = { game, pending: null };
    const visited = new Set<string>([JSON.stringify(gs)]);

    function tryAction(context: EngineContext, resolution: ResolutionRequest | null, dispatchData: Record<string, unknown>, type: string) {
      const dispatch = { dispatchId: randomUUID(), dispatchType: type as any, dispatchData, fromPlayer: 1 as const };
      const result = processPuzzleDispatch(dispatch, context);
      if (result.response.invalidAction) {
        console.log(`  ${type} REJECTED:`, result.response.invalidReason);
        return null;
      }
      const trimmed: EngineContext = { ...result.context, game: { ...result.context.game, gameStateHistory: [] } };
      const newGs = trimmed.game.currentGameState;
      const key = JSON.stringify(newGs);
      const alreadyVisited = visited.has(key);
      if (!alreadyVisited) visited.add(key);
      console.log(`  ${type} OK, base damage=${newGs.player2.base.damage}, defeated=${newGs.defeatedPlayers}, alreadyVisited=${alreadyVisited}, resolution=${result.response.resolutionNeeded?.type ?? 'none'}`);
      return { context: trimmed, resolution: (result.response.resolutionNeeded as ResolutionRequest | undefined) ?? null, visited: alreadyVisited };
    }

    // The winning sequence: deploy Iden → attack 4-LOM → choose base → attack Iden → choose base
    console.log("=== STEP 1: Deploy Iden Versio ===");
    const r1 = tryAction(ctx, null, { cardId: "SOR_002", deployLeader: true, epicAction: true }, "use-ability");
    if (!r1) { expect.fail("Deploy failed"); return; }

    console.log("=== STEP 2: Initiate attack with 4-LOM (playId=2) ===");
    const r2 = tryAction(r1.context, r1.resolution, { playId: "2" }, "initiate-attack");
    if (!r2) { expect.fail("4-LOM attack failed"); return; }

    console.log("=== STEP 3: Choose base as target ===");
    const r3 = tryAction(r2.context, r2.resolution, { targetZones: ["Base"], targetPlayers: [2] }, "choose-target");
    if (!r3) { expect.fail("Choose base failed"); return; }

    console.log("=== STEP 4: Initiate attack with Iden (playId=21) ===");
    const r4 = tryAction(r3.context, r3.resolution, { playId: "21" }, "initiate-attack");
    if (!r4) { expect.fail("Iden attack failed"); return; }

    console.log("=== STEP 5: Choose base as target ===");
    const r5 = tryAction(r4.context, r4.resolution, { targetZones: ["Base"], targetPlayers: [2] }, "choose-target");
    if (!r5) { expect.fail("Final choose base failed"); return; }

    const finalGs = r5.context.game.currentGameState;
    console.log("\nFinal state: base damage =", finalGs.player2.base.damage, "defeatedPlayers =", finalGs.defeatedPlayers);
    console.log("Was final state already visited?", r5.visited);

    expect(finalGs.defeatedPlayers).toContain(2);
    expect(r5.visited).toBe(false); // Should NOT already be visited
  });
});

import { solve } from "@/server/puzzle/solver";

describe("solve()", () => {
  it("returns solvable: true for the iden deploy puzzle", () => {
    const result = solve(rawPuzzle as any);
    console.log("solvable:", result.solvable, "solutions:", result.steps.length, "timedOut:", result.timedOut);
    if (result.steps.length > 0) console.log("first solution:", result.steps[0]);
    expect(result.solvable).toBe(true);
  });
});
