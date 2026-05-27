import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { SetGame } from "@/server/engine/core-functions";
import { hydrateGame, computeSentinelPlayIds, computeUnitBuffs } from "@/server/engine/dispatch-listener";
import type { GameState, Game } from "@/lib/engine/game";

type TestRequest = { initialGamestate?: unknown };
type TestResponse = { gameState: GameState; sentinelPlayIds: string[]; unitBuffs: Record<string, { power: number; hp: number }> } | { error: string };

export default async function handler(request: NextApiRequest, response: NextApiResponse<TestResponse>) {
  if (request.method !== "POST") return methodNotAllowed(response, "POST");

  try {
    const body = request.body as TestRequest;
    if (!body || !body.initialGamestate) return response.status(400).json({ error: "Missing initialGamestate in request body." });

    const gameState = hydratePuzzleGame(body.initialGamestate as any);

    const tempGame: Game = { id: "", currentGameState: structuredClone(gameState), gameStateHistory: [], gameLog: [] };
    hydrateGame(tempGame);
    SetGame(tempGame);
    const sentinelPlayIds = computeSentinelPlayIds(tempGame.currentGameState);
    const unitBuffs = computeUnitBuffs(tempGame.currentGameState);
    SetGame(null);

    return response.status(200).json({ gameState, sentinelPlayIds, unitBuffs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to test puzzle.";
    return response.status(500).json({ error: msg });
  }
}
