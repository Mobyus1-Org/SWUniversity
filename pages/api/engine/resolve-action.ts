import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { resolveEngineAction, type EngineAction, type EngineState } from "@/server/engine/adapters/resolve-action";

type ResolveActionRequestBody = {
  state?: EngineState;
  action?: EngineAction;
};

type ResolveActionResponseBody = {
  state: EngineState;
  serverDurationMs: number;
};

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse<ResolveActionResponseBody | { error: string }>,
) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  const start = performance.now();

  try {
    const body = request.body as ResolveActionRequestBody;
    if (!body?.state || !body?.action) {
      return response.status(400).json({ error: "Missing state or action." });
    }

    const nextState = resolveEngineAction(body.state, body.action);
    const serverDurationMs = Math.round(performance.now() - start);

    return response.status(200).json({
      state: nextState,
      serverDurationMs,
    });
  } catch (error) {
    console.error("engine action resolve error", error);
    return response.status(500).json({ error: "Unable to resolve engine action." });
  }
}
