import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAdminApi } from "@/server/auth/guards";
import { assertRequiredEnv } from "@/server/env";
import { generateCardAssetsAsync, type CardAssetsGenerationSummary } from "@/server/engine/card-db/generator";

type ErrorResponse = {
  error: string;
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<CardAssetsGenerationSummary | ErrorResponse>,
) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  if (process.env.NODE_ENV !== "development") {
    return response.status(403).json({ error: "This endpoint is only available in local development." });
  }

  try {
    assertRequiredEnv();

    const session = await requireAdminApi(request, response);
    if (!session) {
      return;
    }

    const summary = await generateCardAssetsAsync();
    return response.status(200).json(summary);
  } catch (error) {
    console.error("internal card code generator error", error);
    return response.status(500).json({ error: "Unable to generate SWU cards and images." });
  }
}