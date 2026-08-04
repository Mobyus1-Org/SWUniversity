import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { GetAllCardIds, CardTitle, CardSubtitle, CardType } from "@/server/engine/card-db/generated";
import type { CardCatalogEntry } from "@/components/Shared/PuzzleBuilderPanel";

type Response = { cards: CardCatalogEntry[] } | { error: string };

const ALLOWED_SETS = new Set(["SOR", "SHD", "TWI", "JTL", "LOF", "SEC", "IBH", "LAW", "TS26", "ASH"]);

// Token units available in the puzzle builder (ground / space)
const TOKEN_UNIT_IDS = [
  "TWI_T01", // Battle Droid (Ground)
  "TWI_T02", // Clone Trooper (Ground)
  "SEC_T01", // Spy (Ground)
  "JTL_T01", // TIE Fighter (Space)
  "JTL_T02", // X-Wing (Space)
];

// Token upgrades available in the puzzle builder
const TOKEN_UPGRADE_IDS = [
  "SOR_T01", // Experience
  "SOR_T02", // Shield
];

export default function handler(
  request: NextApiRequest,
  response: NextApiResponse<Response>,
) {
  if (request.method !== "GET") {
    return methodNotAllowed(response, "GET");
  }

  const named = GetAllCardIds()
    .filter((cardId) => {
      const setCode = cardId.split("_")[0];
      // exclude token cards (handled separately below)
      if (cardId.includes("_T")) return false;
      return ALLOWED_SETS.has(setCode);
    })
    .map((cardId) => {
      const title = CardTitle(cardId);
      const subtitle = CardSubtitle(cardId);
      const label = subtitle ? `${title} — ${subtitle}` : title;
      return { cardId, label, type: CardType(cardId) };
    })
    .filter((entry) => entry.label.trim().length > 0);

  // Distinct cards can share a label outright — "Surprise Strike" is a different card in SOR and
  // SHD, neither has a subtitle, and the picker showed only the label, so they were impossible to
  // tell apart when adding to a hand. Suffix the set code on collisions ONLY, so the vast majority
  // of entries stay clean.
  const labelCounts = new Map<string, number>();
  for (const entry of named) labelCounts.set(entry.label, (labelCounts.get(entry.label) ?? 0) + 1);

  const regularCards: CardCatalogEntry[] = named
    .map((entry) => (labelCounts.get(entry.label)! > 1
      ? { ...entry, label: `${entry.label} (${entry.cardId.split("_")[0]})` }
      : entry))
    .sort((a, b) => a.label.localeCompare(b.label));

  const tokenCards: CardCatalogEntry[] = [
    ...TOKEN_UNIT_IDS,
    ...TOKEN_UPGRADE_IDS,
  ].map((cardId) => ({
    cardId,
    label: `${CardTitle(cardId)} [Token]`,
    type: CardType(cardId),
  }));

  return response.status(200).json({ cards: [...regularCards, ...tokenCards] });
}
