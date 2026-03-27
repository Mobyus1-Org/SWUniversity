import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { processDispatch } from "@/server/engine/dispatch-listener";
import { getContext, setContext } from "@/server/engine/game-store";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { DispatchResponse, GameDispatch } from "@/lib/engine/message-types";
import type { PlayerId } from "@/lib/engine/core-models";

// ---------------------------------------------------------------------------
// Public dispatch format → internal GameDispatch translation
// ---------------------------------------------------------------------------

type PublicDispatch = {
  type: string;
  playerId: PlayerId;
  [key: string]: unknown;
};

function translateDispatch(
  pub: PublicDispatch,
  context: EngineContext,
): GameDispatch | { error: string } {
  const { type, playerId } = pub;
  const ps = playerId === 1 ? context.game.currentGameState.player1 : context.game.currentGameState.player2;

  switch (type) {
    case "useLeaderAbility":
      return {
        dispatchId: randomUUID(),
        dispatchType: "use-ability",
        dispatchData: { cardId: ps.leader.cardId },
        fromPlayer: playerId,
      };
    case "deployLeader":
      return {
        dispatchId: randomUUID(),
        dispatchType: "use-ability",
        dispatchData: { cardId: ps.leader.cardId, deployLeader: true, epicAction: true },
        fromPlayer: playerId,
      };
    case "passAction":
      return {
        dispatchId: randomUUID(),
        dispatchType: "pass-action",
        dispatchData: {},
        fromPlayer: playerId,
      };
    case "claimInitiative":
      return {
        dispatchId: randomUUID(),
        dispatchType: "claim-initiative",
        dispatchData: {},
        fromPlayer: playerId,
      };
    default:
      return { error: `Unknown public dispatch type: ${type}` };
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type DispatchResponseBody = {
  response: DispatchResponse;
  context?: EngineContext;
  serverDurationMs: number;
};

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse<DispatchResponseBody | { error: string }>,
) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  const start = performance.now();

  try {
    const body = request.body as {
      message: { gameId?: string; dispatch?: unknown } | unknown;
      context: EngineContext | null;
    };

    if (!body.message || typeof body.message !== "object") {
      return response.status(400).json({ error: "Missing or invalid message." });
    }

    const msg = body.message as { gameId?: string; dispatch?: unknown };

    if (!msg.dispatch || typeof msg.dispatch !== "object") {
      return response.status(400).json({ error: "message.dispatch is required." });
    }

    // Resolve context: server-managed (null → look up by gameId) or client-supplied
    let context: EngineContext;
    let serverManaged = false;

    if (!body.context) {
      if (!msg.gameId) {
        return response.status(400).json({ error: "message.gameId is required when context is null." });
      }
      const stored = getContext(msg.gameId);
      if (!stored) {
        return response.status(404).json({ error: `No game found for gameId: ${msg.gameId}` });
      }
      context = stored;
      serverManaged = true;
    } else {
      context = body.context;
    }

    // Translate the public dispatch format to the internal GameDispatch
    const pub = msg.dispatch as PublicDispatch;
    const translated = translateDispatch(pub, context);
    if ("error" in translated) {
      return response.status(400).json({ error: translated.error });
    }

    const result = processDispatch(translated, context);
    const serverDurationMs = Math.round(performance.now() - start);

    if (serverManaged && msg.gameId) {
      setContext(msg.gameId, result.context);
    }

    const responseBody: DispatchResponseBody = {
      response: result.response,
      serverDurationMs,
    };

    if (!serverManaged) {
      responseBody.context = result.context;
    }

    return response.status(200).json(responseBody);
  } catch (error) {
    console.error("engine dispatch error", error);
    return response.status(500).json({ error: "Unable to process dispatch." });
  }
}
