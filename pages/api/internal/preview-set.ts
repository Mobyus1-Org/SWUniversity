import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAdminApi } from "@/server/auth/guards";
import { assertRequiredEnv } from "@/server/env";
import { fetchPreviewSetListAsync, type PreviewSetRow } from "@/server/engine/card-db/preview-client";
import { readMockFileAsync } from "@/server/engine/card-db/card-mocks-writer";
import { CardTitle } from "@/server/engine/card-db/generated";

type SuccessResponse = {
  set: string;
  rows: PreviewSetRow[];
};

type ErrorResponse = {
  error: string;
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (request.method !== "GET") {
    return methodNotAllowed(response, "GET");
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

    const rawSet = typeof request.query.set === "string" ? request.query.set.trim() : "";
    if (!/^[A-Z0-9]{2,5}$/i.test(rawSet)) {
      return response.status(400).json({ error: "A set code like ASH or HMW is required." });
    }

    const set = rawSet.toUpperCase();
    const entries = await fetchPreviewSetListAsync(set);
    if (entries.length === 0) {
      return response.status(404).json({ error: `No previewed cards found for ${set}.` });
    }

    // Status is resolved here rather than in the browser so the panel does not have to pull the
    // whole generated dictionary module into the client bundle.
    const mocks = await readMockFileAsync();
    const rows: PreviewSetRow[] = entries.map((entry) => ({
      ...entry,
      status: CardTitle(entry.cardId) !== "" ? "official" : (entry.cardId in mocks ? "mocked" : "new"),
    }));

    return response.status(200).json({ set, rows });
  } catch (error) {
    console.error("internal preview set listing error", error);
    return response.status(500).json({ error: "Unable to list previewed cards for that set." });
  }
}
