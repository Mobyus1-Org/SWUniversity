/**
 * POST /api/engine/new-game
 *
 * Creates a new server-managed game session. Optionally seeds it with an
 * existing GameState (useful for tests and puzzle replays).
 *
 * Request body:
 *   { withGameState?: GameState }
 *
 * Response body (200):
 *   { gameId: string }
 */

import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { setContext } from "@/server/engine/game-store";
import type { Game, GameState } from "@/lib/engine/game";

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse<{ gameId: string } | { error: string }>,
) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  const { withGameState } = request.body as { withGameState?: GameState };

  if (!withGameState || typeof withGameState !== "object") {
    return response.status(400).json({ error: "withGameState is required." });
  }

  const gameId = randomUUID();

  const game: Game = {
    id: gameId,
    currentGameState: withGameState,
    gameStateHistory: [],
    gameLog: ["Game created."],
  };

  setContext(gameId, { game, pending: null });

  return response.status(200).json({ gameId });
}
