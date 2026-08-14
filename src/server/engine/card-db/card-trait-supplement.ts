import supplementData from "@/server/engine/card-db/card-trait-supplement.json";
import type { StringDictionary } from "@/server/engine/card-db/swu-api-types";

/**
 * Traits the official SWU card API omits, supplied from tracked source.
 *
 * The API publishes NO traits for bases — every one comes back empty — though each prints a
 * location trait (ASH_023 Ancient Henge is "Seatos", ASH_026 Freetown is "Tatooine"). swudb does
 * publish them, so a base mocked during a preview window arrives WITH its trait and would silently
 * lose it on release day when official data takes over. This supplement closes that gap in both
 * directions: the mocked base and the released base end up with identical traits.
 *
 * FILL-GAPS ONLY: an entry applies solely when the API gave nothing for that card id. Official
 * data always wins, so this file goes inert on its own if the API ever starts publishing base
 * traits, rather than masking the upstream values.
 *
 * Regenerate or extend with: `npm run backfill-base-traits`.
 *
 * See docs/superpowers/specs/2026-08-11-card-mock-framework-design.md.
 */
export const cardTraitSupplement = supplementData as Record<string, string>;

/** Comma-joined without spaces, matching how the generator stores traits ("Force,Imperial,Sith"). */
function normalizeTraitString(value: string): string {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(",");
}

/**
 * Applies the supplement to a card id → trait-string map, in place. Returns how many entries were
 * filled. Only missing or blank values are touched.
 */
export function applyTraitSupplement(
  traits: StringDictionary,
  supplement: Record<string, string> = cardTraitSupplement,
): number {
  let filled = 0;

  for (const [cardId, value] of Object.entries(supplement)) {
    if ((traits[cardId] ?? "").trim() !== "") {
      continue;
    }

    const normalized = normalizeTraitString(value);
    if (normalized === "") {
      continue;
    }

    traits[cardId] = normalized;
    filled += 1;
  }

  return filled;
}
