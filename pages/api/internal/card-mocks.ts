import path from "node:path";
import { rm } from "node:fs/promises";
import type { NextApiRequest, NextApiResponse } from "next";

import { requireAdminApi } from "@/server/auth/guards";
import { assertRequiredEnv } from "@/server/env";
import type { MockCard } from "@/server/engine/card-db/card-mocks";
import { deleteMockAsync, readMockFileAsync, upsertMockAsync } from "@/server/engine/card-db/card-mocks-writer";
import { mockArtFileName } from "@/server/engine/card-db/generator";

type SuccessResponse = {
  mocks: Record<string, MockCard>;
};

type ErrorResponse = {
  error: string;
};

const CARD_IMAGE_DIRS = [
  path.join(process.cwd(), "public/assets/cards/full"),
  path.join(process.cwd(), "public/assets/cards/square"),
];

/** Removes a deleted mock's art. Only ever touches the mock_ names. */
async function removeMockArtAsync(cardId: string): Promise<void> {
  for (const directory of CARD_IMAGE_DIRS) {
    for (const fileName of [mockArtFileName(cardId), mockArtFileName(cardId, "_BACK")]) {
      await rm(path.join(directory, fileName), { force: true });
    }
  }
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (!["GET", "POST", "DELETE"].includes(request.method ?? "")) {
    response.setHeader("Allow", "GET, POST, DELETE");
    return response.status(405).json({ error: "Method not allowed" });
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

    if (request.method === "GET") {
      return response.status(200).json({ mocks: await readMockFileAsync() });
    }

    const cardId = typeof request.body?.cardId === "string" ? request.body.cardId : "";
    if (!/^[A-Z0-9]{2,5}_[0-9T]{2,3}$/.test(cardId)) {
      return response.status(400).json({ error: "A valid SET_NNN card id is required." });
    }

    if (request.method === "DELETE") {
      const mocks = await deleteMockAsync(cardId);
      await removeMockArtAsync(cardId);
      return response.status(200).json({ mocks });
    }

    const mock = request.body?.mock as MockCard | undefined;
    if (!mock || typeof mock.title !== "string" || mock.title === "") {
      return response.status(400).json({ error: "A mock card with a title is required." });
    }

    return response.status(200).json({ mocks: await upsertMockAsync(cardId, mock) });
  } catch (error) {
    console.error("internal card mocks error", error);
    return response.status(500).json({ error: "Unable to update card mocks." });
  }
}
