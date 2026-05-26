/**
 * POST /api/puzzle/undo
 *
 * Reverts the game to the previous committed state (last stateChanged snapshot).
 * Only operates on states stored in gameStateHistory.
 *
 * Server-managed:  { gameId: string }
 * Round-trip:      { context: EngineContext }
 *
 * Response: { gameState, gameLog, historyLength, context? }
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { getContext, setContext } from "@/server/engine/game-store";
import { SetGame } from "@/server/engine/core-functions";
import { hydrateGame, computeSentinelPlayIds, computeUnitBuffs } from "@/server/engine/dispatch-listener";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { GameState } from "@/lib/engine/game";
import type { Game } from "@/lib/engine/game";

type RequestBody = {
  gameId?: string;
  context?: EngineContext;
};

type ResponseBody = {
  gameState: GameState;
  gameLog: string[];
  historyLength: number;
  sentinelPlayIds: string[];
  unitBuffs: Record<string, { power: number; hp: number }>;
  context?: EngineContext;
};

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse<ResponseBody | { error: string }>,
) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  const { gameId, context: clientContext } = request.body as RequestBody;

  let ctx: EngineContext;
  let serverManaged = false;

  if (clientContext) {
    ctx = clientContext;
  } else if (gameId) {
    const stored = getContext(gameId);
    if (!stored) {
      return response.status(404).json({ error: `No game found for gameId: ${gameId}` });
    }
    ctx = stored;
    serverManaged = true;
  } else {
    return response.status(400).json({ error: "Either gameId or context is required." });
  }

  const history = ctx.game.gameStateHistory;
  if (history.length === 0) {
    return response.status(400).json({ error: "Nothing to undo." });
  }

  const previous = history[history.length - 1];
  const newCtx: EngineContext = {
    game: {
      ...ctx.game,
      currentGameState: previous,
      gameStateHistory: history.slice(0, -1),
      gameLog: [...ctx.game.gameLog, "Undo."],
    },
    pending: null,
  };

  if (serverManaged && gameId) {
    setContext(gameId, newCtx);
  }

  const tempGame: Game = structuredClone(newCtx.game);
  hydrateGame(tempGame);
  SetGame(tempGame);
  const sentinelPlayIds = computeSentinelPlayIds(tempGame.currentGameState);
  const unitBuffs = computeUnitBuffs(tempGame.currentGameState);
  SetGame(null);

  const body: ResponseBody = {
    gameState: newCtx.game.currentGameState,
    gameLog: newCtx.game.gameLog,
    historyLength: newCtx.game.gameStateHistory.length,
    sentinelPlayIds,
    unitBuffs,
  };

  if (!serverManaged) {
    body.context = newCtx;
  }

  return response.status(200).json(body);
}
