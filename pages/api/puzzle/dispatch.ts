/**
 * POST /api/puzzle/dispatch
 *
 * Puzzle-specific dispatch endpoint that accepts a native GameDispatch
 * (no public-format translation layer). Supports two modes:
 *
 *  Server-managed (USE_HTTP = false):
 *    Body: { gameId: string; dispatch: GameDispatch }
 *    State is stored in the in-memory game-store by gameId. The client only
 *    needs to track the gameId, not the full engine context.
 *
 *  Round-trip / client-managed (USE_HTTP = true):
 *    Body: { dispatch: GameDispatch; context: EngineContext }
 *    Full EngineContext is round-tripped with every request. The server is
 *    stateless; the client holds the live context between calls.
 *
 * Both modes return:
 *   { response: DispatchResponse; gameLog: string[]; context?: EngineContext }
 *
 * `context` is only returned in round-trip mode so the client can re-send it.
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import { getContext, setContext } from "@/server/engine/game-store";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { GameState } from "@/lib/engine/game";
import type { GameDispatch, DispatchResponse } from "@/lib/engine/message-types";

type RequestBody = {
  dispatch: GameDispatch;
  gameId?: string;
  context?: EngineContext;
};

type ResponseBody = {
  response: DispatchResponse;
  gameLog: string[];
  currentGameState: GameState;
  historyLength: number;
  context?: EngineContext;
};

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse<ResponseBody | { error: string }>,
) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  const { dispatch, gameId, context: clientContext } = request.body as RequestBody;

  if (!dispatch || typeof dispatch !== "object") {
    return response.status(400).json({ error: "dispatch is required." });
  }

  let ctx: EngineContext;
  let serverManaged = false;

  if (clientContext) {
    // Round-trip mode: use context supplied by the client
    ctx = clientContext;
  } else if (gameId) {
    // Server-managed mode: look up context from game-store
    const stored = getContext(gameId);
    if (!stored) {
      return response.status(404).json({ error: `No game found for gameId: ${gameId}` });
    }
    ctx = stored;
    serverManaged = true;
  } else {
    return response.status(400).json({ error: "Either gameId or context is required." });
  }

  try {
    const result = processPuzzleDispatch(dispatch, ctx);

    if (serverManaged && gameId) {
      setContext(gameId, result.context);
    }

    const body: ResponseBody = {
      response: result.response,
      gameLog: result.context.game.gameLog,
      currentGameState: result.context.game.currentGameState,
      historyLength: result.context.game.gameStateHistory.length,
    };

    // Only return context in round-trip mode so the client can re-use it
    if (!serverManaged) {
      body.context = result.context;
    }

    return response.status(200).json(body);
  } catch (error) {
    console.error("puzzle dispatch error", error);
    return response.status(500).json({ error: "Unable to process dispatch." });
  }
}
