import type { NextApiRequest, NextApiResponse } from "next";

import { reducePuzzle, type PuzzleIntent, type PuzzleRuntime } from "@/lib/puzzles/engine";
import { methodNotAllowed } from "@/server/auth/http";

type ResolveRequestBody = {
  runtime?: PuzzleRuntime;
  intent?: PuzzleIntent;
};

type ResolveResponseBody = {
  runtime: PuzzleRuntime;
  serverDurationMs: number;
};

export default function handler(request: NextApiRequest, response: NextApiResponse<ResolveResponseBody | { error: string }>) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  const start = performance.now();

  try {
    const body = request.body as ResolveRequestBody;
    if (!body?.runtime || !body?.intent) {
      return response.status(400).json({ error: "Missing runtime or intent." });
    }

    const nextRuntime = reducePuzzle(body.runtime, body.intent);
    const serverDurationMs = Math.round(performance.now() - start);

    return response.status(200).json({
      runtime: nextRuntime,
      serverDurationMs,
    });
  } catch (error) {
    console.error("puzzle resolve error", error);
    return response.status(500).json({ error: "Unable to resolve puzzle action." });
  }
}
