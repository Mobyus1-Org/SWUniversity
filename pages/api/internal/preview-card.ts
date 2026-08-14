import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAdminApi } from "@/server/auth/guards";
import { assertRequiredEnv } from "@/server/env";
import type { MockCard } from "@/server/engine/card-db/card-mocks";
import { fetchPreviewCardAsync, parsePreviewLink, previewRecordToMock } from "@/server/engine/card-db/preview-client";

type SuccessResponse = {
  cardId: string;
  mock: MockCard;
};

type ErrorResponse = {
  error: string;
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<SuccessResponse | ErrorResponse>,
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

    const link = typeof request.body?.link === "string" ? request.body.link : "";
    const parsed = parsePreviewLink(link);
    if (!parsed) {
      return response.status(400).json({ error: "Could not read a set and card number from that link." });
    }

    const record = await fetchPreviewCardAsync(parsed.set, parsed.number);
    if (!record) {
      return response.status(404).json({ error: `No preview data for ${parsed.set}/${parsed.number}.` });
    }

    const mock = previewRecordToMock(record);
    return response.status(200).json({ cardId: `${parsed.set}_${parsed.number}`, mock });
  } catch (error) {
    console.error("internal preview card import error", error);
    return response.status(500).json({ error: "Unable to import preview card." });
  }
}
