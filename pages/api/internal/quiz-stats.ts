import type { NextApiRequest, NextApiResponse } from "next";

import { requireAdminApi } from "@/server/auth/guards";
import { methodNotAllowed } from "@/server/auth/http";
import { assertRequiredEnv } from "@/server/env";
import { getDykCountsServer, getQuizCountsServer } from "@/server/stats";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    return methodNotAllowed(response, "GET");
  }

  try {
    assertRequiredEnv();

    const session = await requireAdminApi(request, response);
    if (!session) {
      return;
    }

    const [quizCounts, dykCounts] = await Promise.all([
      getQuizCountsServer(),
      getDykCountsServer(),
    ]);

    return response.status(200).json({
      quizCounts,
      dykSWUCounts: dykCounts,
    });
  } catch (error) {
    console.error("internal quiz stats error", error);
    return response.status(500).json({ error: "Unable to load internal stats." });
  }
}
