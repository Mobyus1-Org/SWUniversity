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
import { HasCoordinate } from "./coordinate";
import { HasSupport } from "./support";
import { ExploitAmount } from "./exploit";
import { HasPlot } from "./plot";
import { HasFortify } from "./fortify";
import { SmuggleCost } from "./smuggle";
import { PilotingCost } from "./piloting";
import { GetUnitInPlay } from "@/server/engine/core-functions";
import type { Unit as UnitInterface } from "@/lib/engine/core-models";

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
  if (HasCoordinate(cardId, playId, player)) kw.add("Coordinate");
  if (HasSupport(cardId, playId, player)) kw.add("Support");
  if (HasPlot(cardId, playId, player)) kw.add("Plot");
  // Printed-only keywords: they have no granted form, so only a unit that lost its abilities
  // loses them.
  const blanked = player && playId ? !!GetUnitInPlay(playId, player)?.LostAbilities() : false;
  if (!blanked) {
    if (ExploitAmount(cardId, undefined, undefined, true) > 0) kw.add("Exploit");
    if (SmuggleCost(cardId) >= 0) kw.add("Smuggle");
    if (PilotingCost(cardId) >= 0) kw.add("Piloting");
    if (HasFortify(cardId)) kw.add("Fortify");
  }
  return kw;
}

/**
 * How many DIFFERENT keywords a unit in play has (TS26_03 Maul). Granted keywords count, and a
 * numeric keyword counts once however it stacks (Raid 1 + Raid 2 is one keyword).
 */
export function DistinctKeywordCount(unit: UnitInterface): number {
  return CardKeywords(unit.cardId, unit.controller, unit.playId).size;
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
