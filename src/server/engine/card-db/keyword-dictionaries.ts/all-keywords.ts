import { PlayerId } from "@/lib/engine/core-models";
import { HasSentinel } from "./sentinel";
import { HasAmbush } from "./ambush";
import { HasGrit } from "./grit";
import { HasSaboteur } from "./saboteur";
import { HasShielded } from "./shielded";
import { HasOverwhelm } from "./overwhelm";
import { HasHidden } from "./hidden";
import { RaidAmount } from "./raid";
import { RestoreAmount } from "./restore";
import { CountBounties } from "./bounty";

/**
 * The set of keyword names a card has (base plus any granted via upgrades/effects when player/playId
 * are supplied). Used by cards that reason about "sharing a keyword" — LOF_005 Morgan Elsbeth.
 * Covers the combat keywords that appear on units; numeric keywords (Raid/Restore) count as present
 * when their amount is positive.
 */
export function CardKeywords(cardId: string, player?: PlayerId, playId?: string): Set<string> {
  const kw = new Set<string>();
  if (HasSentinel(cardId, playId, player)) kw.add("Sentinel");
  if (HasAmbush(cardId, playId, undefined, player)) kw.add("Ambush");
  if (HasGrit(cardId, playId, player)) kw.add("Grit");
  if (HasSaboteur(cardId, playId, player)) kw.add("Saboteur");
  if (HasShielded(cardId, playId, player)) kw.add("Shielded");
  if (HasOverwhelm(cardId, playId, player)) kw.add("Overwhelm");
  if (HasHidden(cardId, playId, player)) kw.add("Hidden");
  if (RaidAmount(cardId, playId, player) > 0) kw.add("Raid");
  if (RestoreAmount(cardId, playId, player) > 0) kw.add("Restore");
  if (CountBounties(cardId, playId, player) > 0) kw.add("Bounty");
  return kw;
}

/** Whether two cards share at least one keyword. */
export function SharesKeyword(
  cardIdA: string, cardIdB: string,
  a: { player?: PlayerId; playId?: string } = {},
  b: { player?: PlayerId; playId?: string } = {},
): boolean {
  const ka = CardKeywords(cardIdA, a.player, a.playId);
  if (ka.size === 0) return false;
  const kb = CardKeywords(cardIdB, b.player, b.playId);
  for (const k of ka) if (kb.has(k)) return true;
  return false;
}
