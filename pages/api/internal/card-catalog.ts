import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { GetAllCardIds, CardTitle, CardSubtitle, CardType } from "@/server/engine/card-db/generated";
import type { CardCatalogEntry } from "@/components/Shared/PuzzleBuilderPanel";

type Response = { cards: CardCatalogEntry[] } | { error: string };

const ALLOWED_SETS = new Set(["SOR", "SHD", "TWI"]);

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse<Response>,
) {
  if (request.method !== "GET") {
    return methodNotAllowed(response, "GET");
  }

  const cards: CardCatalogEntry[] = GetAllCardIds()
    .filter((cardId) => {
      const setCode = cardId.split("_")[0];
      // exclude token cards (e.g. SOR_T01)
      if (cardId.includes("_T")) return false;
      return ALLOWED_SETS.has(setCode);
    })
    .map((cardId) => {
      const title = CardTitle(cardId);
      const subtitle = CardSubtitle(cardId);
      const label = subtitle ? `${title} — ${subtitle}` : title;
      return { cardId, label, type: CardType(cardId) };
    })
    .filter((entry) => entry.label.trim().length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  return response.status(200).json({ cards });
}
