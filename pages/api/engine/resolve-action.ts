import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { resolveEngineAction, type EngineState, type PuzzleUiHints } from "@/server/puzzle/adapters/resolve-action";

type ResolveActionResponseBody = {
  state: EngineState;
  ui: PuzzleUiHints;
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
    const { state, action } = request.body;
    if (!action) {
      return response.status(400).json({ error: "Missing action." });
    }

    // If state is null, treat as new game
    const result = resolveEngineAction(state ?? undefined, action);
    const serverDurationMs = Math.round(performance.now() - start);

    return response.status(200).json({
      state: result.state,
      ui: result.ui,
      serverDurationMs,
    });
  } catch (error) {
    console.error("engine action resolve error", error);
    return response.status(500).json({ error: "Unable to resolve engine action." });
  }
}
