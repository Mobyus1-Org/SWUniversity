import type { NextApiRequest, NextApiResponse } from "next";

import { requireAdminApi } from "@/server/auth/guards";
import { methodNotAllowed } from "@/server/auth/http";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { CardImplStatusModel } from "@/server/models/CardImplStatus";
import { validateStatusUpdate } from "@/server/cards-impl/validate-update";
import { nextPriorityRank, type CardImplRow } from "@/server/cards-impl/status-board";
import { InScopeBoardCardIds, IsInScopeBoardCard } from "@/server/engine/card-db/card-scope";
import { CardSubtitle, CardTitle, CardType } from "@/server/engine/card-db/generated";

async function readRows(): Promise<CardImplRow[]> {
  const docs = await CardImplStatusModel.find({}).lean();
  return docs.map((d) => ({
    cardId: d.cardId,
    status: d.status,
    note: d.note || undefined,
    priorityRank: d.priorityRank,
    updatedBy: d.updatedBy || "",
    updatedAt: new Date((d as { updatedAt?: Date }).updatedAt ?? Date.now()).toISOString(),
  }));
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (!["GET", "POST"].includes(request.method || "")) {
    return methodNotAllowed(response, "GET, POST");
  }

  try {
    assertRequiredEnv();

    const session = await requireAdminApi(request, response);
    if (!session) return;

    await connectToDatabase();

    if (request.method === "GET") {
      const cards = InScopeBoardCardIds().map((cardId) => ({
        cardId,
        title: CardTitle(cardId) ?? cardId,
        subtitle: CardSubtitle(cardId) ?? "",
        set: cardId.split("_")[0],
        type: CardType(cardId) ?? "",
      }));
      return response.status(200).json({ cards, statuses: await readRows() });
    }

    const validated = validateStatusUpdate(request.body, IsInScopeBoardCard);
    if (!validated.ok) {
      return response.status(400).json({ error: validated.error });
    }
    const { cardId, status, note, priorityRank } = validated.value;

    // Entering Priority without an explicit rank appends to the end of the lane.
    let rank = priorityRank;
    if (status === "priority" && rank === undefined) {
      rank = nextPriorityRank(await readRows());
    }

    // $set and $unset are written explicitly rather than relying on Mongoose folding bare fields
    // into $set — mixing the two shapes in one object is easy to get subtly wrong.
    const update = status === "priority"
      ? { $set: { cardId, status, note: note ?? "", priorityRank: rank, updatedBy: session.user.username } }
      : {
          // Leaving Priority clears the rank so a later re-entry appends cleanly.
          $set: { cardId, status, note: note ?? "", updatedBy: session.user.username },
          $unset: { priorityRank: 1 },
        };

    await CardImplStatusModel.findOneAndUpdate({ cardId }, update, { upsert: true, new: true });

    return response.status(200).json({ statuses: await readRows() });
  } catch (error) {
    console.error("card-impl admin api error", error);
    return response.status(500).json({ error: "Unable to update card implementation status." });
  }
}
