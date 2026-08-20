import { CardArena, CardAspects, CardCost, CardIsUnique, CardText, CardTitle, CardTraits, CardType, CardType2 } from "@/server/engine/card-db/generated";
import { LeaderBackSideOf, LeaderFrontAspectsOf } from "@/server/engine/card-db/double-sided-leaders";
import { SupportGrantedCardId } from "@/server/engine/card-db/keyword-dictionaries.ts/support";
import { Card, CardInPlay, CardTypes, CurrentEffect, EffectDuration, HP_MOD, Leader, PHASE_STAT_MOD, POWER_MOD, PlayerId, Resource, Unit as UnitInterface } from "@/lib/engine/core-models";
import { Game, GameState, PlayerState } from "@/lib/engine/game";
import { Unit } from "@/server/engine/unit";
import { SmuggleCost } from "@/server/engine/card-db/keyword-dictionaries.ts/smuggle";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { AbilityOptionPending, AbilityTargetPending, DeckSearchPending, PendingResolution } from "@/server/engine/pending-resolution";
import { UpgradeEligibleTargets } from "@/server/engine/card-db/upgrade-attach-restrictions";

let activeGame: Game | null = null;

export function SetGame(game: Game | null): void {
  activeGame = game;
}

export function GetGame(): Game | null {
  return activeGame;
}

export function GetGameState(): GameState {
  const g = GetGame();
  if (!g) throw new Error("Game not found");
  return g.currentGameState;
}

export function WriteGameLog(message: string): void {
  activeGame?.gameLog.push(message);
}

export function GetCardInPlay(playId: string, player?: PlayerId): CardInPlay | null {
  const game = GetGame();
  if (!game) {
    return null;
  }

  if (player) {
    const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
    const allCardsInPlay = [...playerObj.spaceArena, ...playerObj.groundArena, ...playerObj.resources, ...playerObj.discard];

    return allCardsInPlay.find(card => card.playId === playId) || null;
  }

  const allCardsInPlay = [
    ...game.currentGameState.player1.spaceArena,
    ...game.currentGameState.player1.groundArena,
    ...game.currentGameState.player1.resources,
    ...game.currentGameState.player1.discard,
    ...game.currentGameState.player2.spaceArena,
    ...game.currentGameState.player2.groundArena,
    ...game.currentGameState.player2.resources,
    ...game.currentGameState.player2.discard,
  ];

  return allCardsInPlay.find((card) => card.playId === playId) || null;
}

export function PlayerControlsCardWithTitle(player: PlayerId, title: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const leader = player === 1 ? game.currentGameState.player1.leader : game.currentGameState.player2.leader;
  const units = player === 1 ? [...game.currentGameState.player1.spaceArena, ...game.currentGameState.player1.groundArena] : [...game.currentGameState.player2.spaceArena, ...game.currentGameState.player2.groundArena];
  const upgrades = units.flatMap(unit => unit.upgrades || []);

  return CardTitle(leader.cardId) === title ||
    units.some(u => CardTitle(u.cardId) === title) ||
    upgrades.some(u => CardTitle(u.cardId) === title);
}

export function PlayerControlsCardWithTrait(player: PlayerId, trait: string, another: boolean = false, playId?: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const leader = player === 1 ? game.currentGameState.player1.leader : game.currentGameState.player2.leader;
  const units = player === 1 ? [...game.currentGameState.player1.spaceArena, ...game.currentGameState.player1.groundArena] : [...game.currentGameState.player2.spaceArena, ...game.currentGameState.player2.groundArena];
  const upgrades = units.flatMap(unit => unit.upgrades || []);

  if (another && playId) {
    if (units.some(u => TraitContains(u.cardId, trait, player, u.playId) && u.playId !== playId)) {
      return true;
    }

    if (upgrades.some(u => TraitContains(u.cardId, trait, player, u.playId) && u.playId !== playId)) {
      return true;
    }

    return TraitContains(leader.cardId, trait);
  }

  return CardTraits(leader.cardId)?.includes(trait) ||
    units.some(u => TraitContains(u.cardId, trait, player, u.playId)) ||
    upgrades.some(u => TraitContains(u.cardId, trait, player, u.playId));
}

export function GetUnitInPlay(playId: string, player?: PlayerId): Unit | null {
  const cardInPlay = GetCardInPlay(playId, player);
  if (!cardInPlay) {
    return null;
  }

  return Unit.FromInterface(cardInPlay as Unit);
}

export function GetUnitsForPlayer(player: PlayerId, readyOnly: boolean = false): Unit[] {
  const game = GetGame();
  if (!game) {
    return [];
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  let units = [...playerObj.spaceArena, ...playerObj.groundArena] as Unit[];
  if (readyOnly) {
    units = units.filter(unit => unit.ready);
  }
  return units;
}

/**
 * Every captured card currently held by any unit in play, on either side (CR 8.33 — captives sit
 * facedown under their captor). Used by cards that can rescue a captured card (e.g. L3-37 SHD_197).
 */
export function AllCaptives(): { playId: string; cardId: string; owner: PlayerId }[] {
  const game = GetGame();
  if (!game) return [];
  const out: { playId: string; cardId: string; owner: PlayerId }[] = [];
  for (const pState of [game.currentGameState.player1, game.currentGameState.player2]) {
    for (const u of [...pState.groundArena, ...pState.spaceArena]) {
      for (const captive of u.captives ?? []) {
        out.push({ playId: captive.playId, cardId: captive.cardId, owner: captive.owner });
      }
    }
  }
  return out;
}

export function PlayerHasUnitInPlay(player: PlayerId, cardId: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const allUnitsInPlay = [...playerObj.spaceArena, ...playerObj.groundArena];

  return allUnitsInPlay.some(card => card.cardId === cardId);
}

export function PlayerHasUnitWithTraitInPlay(player: PlayerId, trait: string,
    another: boolean = false, playId?: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const allUnitsInPlay = [...playerObj.spaceArena, ...playerObj.groundArena];

  if (another && playId) {
    return allUnitsInPlay.some(unit => unit.playId !== playId && TraitContains(unit.cardId, trait));
  }

  return allUnitsInPlay.some(unit => TraitContains(unit.cardId, trait));
}

export function PlayerHasUnitWithAspectInPlay(player: PlayerId, aspect: string,
    another: boolean = false, playId?: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const allUnitsInPlay = [...playerObj.spaceArena, ...playerObj.groundArena];

  if (another && playId) {
    return allUnitsInPlay.some(unit => unit.playId !== playId && CardAspects(unit.cardId)?.includes(aspect));
  }

  return allUnitsInPlay.some(unit => CardAspects(unit.cardId)?.includes(aspect));
}

export function PlayerHasUnitInPlayWithMinimumPower(player: PlayerId, minimumPower: number): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const allUnitsInPlay = [...playerObj.spaceArena, ...playerObj.groundArena];

  return allUnitsInPlay.some(unit => Unit.FromInterface(unit).CurrentPower() >= minimumPower);
}

export function PlayerHasTokenUnitInPlay(player: PlayerId): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const allUnitsInPlay = [...playerObj.spaceArena, ...playerObj.groundArena];

  return allUnitsInPlay.some(unit => Unit.FromInterface(unit).IsTokenUnit());
}

export function PlayerHasUnitsInHand(player: PlayerId, filters?: {
  trait?: string;
  aspect?: string;
  maxCost?: number;
}): boolean {
  const hand = GetHand(player);

  return hand.some(card => {
    // Every caller is a "play a UNIT from your hand" ability. Without this the check passed on
    // any card at all, so an ability could be offered with a hand of only events — and then eat
    // its cost with nothing legal to play.
    if (CardType(card.cardId) !== "Unit") {
      return false;
    }

    if (filters?.trait && !CardTraits(card.cardId).includes(filters.trait)) {
      return false;
    }

    if (filters?.aspect && !CardAspects(card.cardId).includes(filters.aspect)) {
      return false;
    }

    if (filters?.maxCost && CardCost(card.cardId) > filters.maxCost) {
      return false;
    }

    return true;
  });
}

export function PlayerHasCardsToSmuggle(player: PlayerId): boolean {
  const resources = GetResources(player);

  return resources.some(r => {
    const smuggleCost = SmuggleCost(r.cardId);

    return smuggleCost > 0;
  })
}

export function UnitIsInPlay(cardId: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const allUnitsInPlay = [
    ...game.currentGameState.player1.spaceArena,
    ...game.currentGameState.player1.groundArena,
    ...game.currentGameState.player2.spaceArena,
    ...game.currentGameState.player2.groundArena,
  ];

  return allUnitsInPlay.some(unit => unit.cardId === cardId);
}

export function NumberOfUnitsInArena(player: PlayerId, arena: "Space" | "Ground"): number {
  const game = GetGame();
  if (!game) {
    return 0;
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const arenaUnits = arena === "Space" ? playerObj.spaceArena : playerObj.groundArena;

  return arenaUnits.length;
}

export function GetPlayIdForUniqueUnitInPlay(cardId: string, player: PlayerId): string {
  if (CardIsUnique(cardId)) {
    const game = GetGame();
    if (!game) {
      return "0";
    }

    const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
    const allUnitsInPlay = [...playerObj.spaceArena, ...playerObj.groundArena];

    const unitInPlay = allUnitsInPlay.find(unit => unit.cardId === cardId);
    return unitInPlay ? unitInPlay.playId : "0";
  }

  return "0";
}

export function GetCurrentEffects(): CurrentEffect[] {
  const game = GetGame();
  if (!game) {
    return [];
  }

  return game.currentGameState.currentEffects;
}

export function GetCurrentEffectsForPlayer(player: PlayerId): CurrentEffect[] {
  const game = GetGame();
  if (!game) {
    return [];
  }

  return game.currentGameState.currentEffects.filter(effect => effect.affectedPlayer === player);
}

export function SearchCurrentEffects(cardId: string, player?: PlayerId): CurrentEffect[] {
  const game = GetGame();
  if (!game) {
    return [];
  }

  return game.currentGameState.currentEffects.filter(effect => effect.cardId === cardId && (!player || effect.affectedPlayer === player));
}

export function CardIsBase(cardId: string): boolean {
  return CardType(cardId) === "Base";
}

export function CardIsLeader(cardId: string): boolean {
  return CardType(cardId) === "Leader";
}

/**
 * A double-sided leader flips between two LEADER faces instead of deploying into a unit
 * (TWI_017 Chancellor Palpatine // Darth Sidious). Detected from the data — `cardType2` is
 * "Leader" rather than "Unit" — so a future one needs no code change here.
 */
export function LeaderIsDoubleSided(cardId: string): boolean {
  return CardIsLeader(cardId) && CardType2(cardId) === "Leader";
}

/** False for a leader that has no unit side and therefore can never be deployed. */
export function LeaderHasUnitSide(cardId: string): boolean {
  return !LeaderIsDoubleSided(cardId);
}

/**
 * The title/traits of the face a leader is currently showing.
 *
 * A flipped double-sided leader is a different character with different traits — Darth Sidious is
 * Force/Separatist/Sith where Chancellor Palpatine is Republic/Official — but the generated
 * dictionaries only carry the front side, because the upstream card API has no second-side title
 * or traits at all. The back face comes from the hand-maintained double-sided-leaders module.
 */
export function LeaderSideTitle(cardId: string, flipped: boolean): string {
  const back = flipped ? LeaderBackSideOf(cardId) : null;
  return back?.title ?? CardTitle(cardId);
}

export function LeaderSideTraits(cardId: string, flipped: boolean): string[] {
  const back = flipped ? LeaderBackSideOf(cardId) : null;
  return back?.traits ?? CardTraits(cardId);
}

/**
 * The aspect icons the face a leader is currently showing provides.
 *
 * For every ordinary leader this is just its printed aspects. A double-sided leader's generated
 * entry is the UNION of both faces (TWI_017: Cunning/Villainy/Heroism), so reading it directly
 * would have Chancellor Palpatine covering Villainy and Darth Sidious covering Heroism — no card
 * would ever pay an aspect penalty. Each face contributes only its own two icons.
 */
export function LeaderSideAspects(cardId: string, flipped: boolean): string[] {
  const side = flipped ? LeaderBackSideOf(cardId)?.aspects : LeaderFrontAspectsOf(cardId);
  return side ?? CardAspects(cardId);
}

/**
 * "If a friendly <Aspect> unit was defeated this phase" (TWI_017 front). The sibling of
 * UnitWasDefeatedThisPhase, which matches on TRAIT — these two conditions read alike on the
 * cards but are different card properties, and using the wrong one silently never matches.
 */
export function UnitWithAspectWasDefeatedThisPhase(player: PlayerId, aspect: string): boolean {
  const game = GetGame();
  if (!game) return false;
  return game.currentGameState.roundState.cardsLeftPlayThisPhase.some(
    left => left.fromPlayer === player
      && (left.reason === "defeated" || left.reason === "token-defeated")
      && CardAspects(left.cardId).includes(aspect),
  );
}

/** "If you played a <Aspect> card this phase" (TWI_017 back). Aspect, not trait — see above. */
export function CardWithAspectWasPlayedThisPhase(player: PlayerId, aspect: string): boolean {
  const game = GetGame();
  if (!game) return false;
  return game.currentGameState.roundState.cardsPlayedThisPhase.some(
    played => played.fromPlayer === player && CardAspects(played.cardId).includes(aspect),
  );
}

/**
 * How many leader units `player` controls — the scaling term shared by all four TS26 bases
 * ("For each friendly leader unit, …").
 *
 * A leader UNIT is a Leader-typed card actually sitting in an arena, so an undeployed leader
 * counts for nothing, and a leader unit whose control you have seized counts for you (the
 * arenas are keyed by controller, not owner).
 */
/**
 * The leader UNITS `player` controls.
 *
 * Two shapes count, and missing the second is an easy bug: a leader deployed normally IS the
 * unit (its cardId is the Leader card), but a leader deployed as a PILOT is an upgrade — the
 * unit it rides becomes the leader unit, and that host keeps its own card's aspects and traits.
 */
export function FriendlyLeaderUnits(player: PlayerId): Unit[] {
  return GetUnitsForPlayer(player).filter(
    u => CardIsLeader(u.cardId) || u.upgrades.some(up => CardIsLeader(up.cardId)),
  );
}

export function FriendlyLeaderUnitCount(player: PlayerId): number {
  return FriendlyLeaderUnits(player).length;
}

export function GetLeaderForPlayer(player: PlayerId): Leader {
  const game = GetGame();
  if (!game) {
    throw new Error("Game not found");
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return playerObj.leader;
}

export function TraitContains(cardId: string, trait: string, player?: PlayerId, playId?: string): boolean {
  const isBase = CardIsBase(cardId);
  const isLeaderSide = CardIsLeader(cardId) && player && !GetLeaderForPlayer(player).deployed;

  // A flipped double-sided leader is a different character with different traits: Darth Sidious
  // is Force/Separatist/Sith where Chancellor Palpatine is Republic/Official. The generated
  // dictionary only holds the front side, so the back face is answered from its own data and
  // must NOT fall through to the front-side lookup below.
  if (player !== undefined && LeaderIsDoubleSided(cardId) && GetLeaderForPlayer(player).flipped) {
    return LeaderSideTraits(cardId, true).includes(trait);
  }
  if (playId && !isLeaderSide && !isBase) {
    const unit = GetUnitInPlay(playId, player);
    const upgrades = unit?.upgrades || [];
    for(const u of upgrades) {
      switch (u.cardId) {
        case "SHD_069"://Foundling
          if(trait === "Mandalorian") return true;
          break;
        case "LOF_052"://Jedi Trials
          if(trait === "Jedi" && (upgrades.length || 0) >= 4) return true;
          break;
        case "LOF_054"://Exiled From The Force
          if(trait === "Force") return false;
          break;
        default: break;
      }
    }

    if (unit?.isClone && trait === "Clone") return true;
  }

  if(trait == "Force" && SearchCurrentEffects("LOF_033", player).length > 0) { //Nameless Terror
     WriteGameLog("Nameless Terror prevented Force Trait");
     return false;
  }

  if (player) {
    if(PlayerHasUnitInPlay(player, "LOF_073") && //Mythosaur - Folklore Awakend
        CardIsLeader(cardId) && trait === "Mandalorian") {
      return true;
    }
  }

  return CardTraits(cardId).includes(trait) ?? false;
}

export function IsCoordinateActive(player: PlayerId): boolean {
  return GetUnitsForPlayer(player).length >= 3;
}

export function InitiativePlayer(): PlayerId | null {
  const game = GetGame();
  if (!game) {
    return null;
  }

  return game.currentGameState.initiativePlayer;
}

export function LeaderAbilitiesIgnored(): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  return UnitIsInPlay("TWI_255"); //Brain Invaders
}

export function GetResources(player: PlayerId, availableOnly = false): CardInPlay[] {
  const game = GetGame();
  if (!game) {
    return [];
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return availableOnly ? playerObj.resources.filter(resource => resource.ready) : playerObj.resources;
}

/**
 * "Defeat a friendly resource" — removes the resource from the resource row and puts the card
 * in its owner's discard pile. Returns false when the playId isn't one of the player's
 * resources. Ready or exhausted, either can be defeated.
 */
export function DefeatResource(
  gs: GameState,
  player: PlayerId,
  resourcePlayId: string,
  gameLog: string[],
  fromCardId?: string,
): boolean {
  const playerObj = player === 1 ? gs.player1 : gs.player2;
  const index = playerObj.resources.findIndex(r => r.playId === resourcePlayId);
  if (index === -1) return false;

  const [defeated] = playerObj.resources.splice(index, 1);
  const owner = defeated.owner ?? player;
  const ownerObj = owner === 1 ? gs.player1 : gs.player2;
  ownerObj.discard.push({
    ...defeated,
    controller: owner,
    turnDiscarded: gs.currentRound,
    discardEffect: "",
  });

  const prefix = fromCardId ? `${CardTitle(fromCardId)}: ` : "";
  gameLog.push(`${prefix}Player ${player} defeated a resource (${CardTitle(defeated.cardId)}).`);
  return true;
}

/** Damage currently on the given player's base. */
export function GetBaseDamage(player: PlayerId): number {
  const game = GetGame();
  if (!game) return 0;
  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return playerObj.base.damage;
}

export function HasTheForce(player: PlayerId) {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;

  return playerObj.supplemental.forceToken === true;
}

/**
 * "The Force is with you" — create the player's Force token in their base zone.
 * Idempotent: if the player already controls their Force token, the instruction is
 * ignored (CR 37.1). Passive/repeatable — callers may invoke it every time it triggers.
 */
export function CreateForceToken(player: PlayerId, gameLog: string[], fromCardId?: string): void {
  const game = GetGame();
  if (!game) return;

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  if (playerObj.supplemental.forceToken === true) return; // already controls it — ignore

  playerObj.supplemental.forceToken = true;
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: Player ${player} created their Force token.`);
  } else {
    gameLog.push(`Player ${player} created their Force token.`);
  }
}

/**
 * "Use the Force" — the player may defeat their Force token (CR 37.4). Returns true if
 * the token was used (so callers can gate an "If you do…" effect), false if the player
 * did not control their Force token.
 */
export function UseTheForce(player: PlayerId, gameLog: string[], fromCardId?: string): boolean {
  const game = GetGame();
  if (!game) return false;

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  if (playerObj.supplemental.forceToken !== true) return false;

  playerObj.supplemental.forceToken = false;
  game.currentGameState.roundState.forceUsedThisPhase += 1;
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: Player ${player} used the Force.`);
  } else {
    gameLog.push(`Player ${player} used the Force.`);
  }

  QueueUseTheForceReactions(player, game.currentGameState);
  return true;
}

/** Cards with a "When you use the Force:" reaction. */
function CardHasUseTheForceReaction(cardId: string): boolean {
  switch (cardId) {
    case "LOF_260": //The Father — may deal 1 damage to itself to regain the Force token
      return true;
    default:
      return false;
  }
}

/**
 * "When you use the Force" reactions belong to the player who spent the token, so only units
 * that player controls trigger. Pushed onto the trigger bag from the single UseTheForce
 * choke point, so every Force-spending card fires them.
 */
function QueueUseTheForceReactions(player: PlayerId, gs: GameState): void {
  for (const unit of GetUnitsForPlayer(player)) {
    if (!CardHasUseTheForceReaction(unit.cardId)) continue;
    if (unit.LostAbilities()) continue;
    gs.triggerBag.push({
      triggerType: "use-the-force",
      cardId: unit.cardId,
      fromPlayer: player,
      playId: unit.playId,
    });
  }
}

/**
 * TWI_132 Confederate Tri-Fighter: "Bases can't be healed." A static ability affecting ALL bases
 * (both players'), active while any Tri-Fighter is in play. Base-heal sites across the engine call
 * this to skip the heal (unit healing is unaffected). Base healing is not centralized, so each site
 * guards itself — see the callers of this function.
 */
export function BaseHealingPrevented(): boolean {
  const game = GetGame();
  if (!game) return false;
  const gs = game.currentGameState;
  for (const pState of [gs.player1, gs.player2]) {
    for (const u of [...pState.groundArena, ...pState.spaceArena]) {
      if (u.cardId === "TWI_132") return true;
    }
  }
  return false;
}

/**
 * ASH_070 At Attin Safety Droid: "If your base would be dealt more than 4 damage, prevent all but
 * 4 of that damage." A per-instance cap on damage to its controller's own base — only checked
 * when `targetPlayer` (the player whose base is being hit) controls a live Safety Droid. Base
 * damage is not centralized, so each site routes its amount through this before applying it —
 * see the callers of this function.
 */
export function CapBaseDamage(targetPlayer: PlayerId, amount: number): number {
  if (amount <= 4) return amount;
  const game = GetGame();
  if (!game) return amount;
  const hasSafetyDroid = GetUnitsForPlayer(targetPlayer).some(u => {
    if (u.cardId !== "ASH_070") return false;
    const unit = GetUnitInPlay(u.playId, targetPlayer);
    return !!unit && !unit.LostAbilities();
  });
  return hasSafetyDroid ? 4 : amount;
}

/**
 * Applies `amount` damage to `player`'s base: caps it (ASH_070), increments base damage, tracks
 * `baseDamagedThisPhase` (when `byPlayer` is given), and fires the generic when-base-damaged
 * reaction (ASH_204). The single choke point for base damage — call this instead of mutating
 * `base.damage` directly so every future "when your base is dealt damage" card keeps working.
 */
export function DealDamageToBase(gs: GameState, player: PlayerId, amount: number, byPlayer?: PlayerId): void {
  amount = CapBaseDamage(player, amount);
  GetPlayer(gs, player).base.damage += amount;
  if (byPlayer !== undefined) {
    gs.roundState.baseDamagedThisPhase ??= [];
    gs.roundState.baseDamagedThisPhase.push({ byPlayer, target: player, amount });
  }
  QueueWhenBaseDamagedReaction(gs, player, amount);
}

/**
 * Heals `amount` damage from a player's base, floored at 0. Shared by every card that
 * heals a base (Grassroots Resistance, Lost and Forgotten, …).
 */
export function HealBaseForPlayer(
  gs: GameState,
  player: PlayerId,
  amount: number,
  gameLog: string[],
  fromCardId?: string,
): void {
  if (BaseHealingPrevented()) return; // TWI_132 Confederate Tri-Fighter
  const playerObj = player === 1 ? gs.player1 : gs.player2;
  const healed = Math.min(amount, playerObj.base.damage);
  if (healed <= 0) return;
  playerObj.base.damage -= healed;
  const prefix = fromCardId ? `${CardTitle(fromCardId)}: ` : "";
  gameLog.push(`${prefix}healed ${healed} damage from Player ${player}'s base.`);
}

/**
 * True when `unit` has a "When Defeated" ability that another card could use (Chimaera JTL_039).
 * Covers the three ways a unit can have one: printed on the card, granted by a Droid Cohort
 * (TWI_218) upgrade, or granted to every other friendly unit by General Krell (SOR_105).
 */
export function UnitHasWhenDefeatedAbility(unit: Unit): boolean {
  if (unit.LostAbilities()) return false;
  if (CardText(unit.cardId).includes("When Defeated")) return true;
  if (unit.upgrades.some(u => u.cardId === "TWI_218")) return true;
  return GetUnitsForPlayer(unit.controller)
    .some(u => u.cardId === "SOR_105" && u.playId !== unit.playId);
}

/**
 * Gives a unit a +X/+X (or –X/–X, when `amount` is negative) modifier for this phase.
 * Shared by every card with a "for this phase" stat modifier — the amount rides on the
 * effect's `value`, so Unit.CurrentPower/TotalHP read it generically and no per-card
 * case is needed.
 */
/**
 * Gives `target` a keyword for the phase via a current effect keyed to `sourceCardId`. The keyword
 * dictionaries read effects with `GetCurrentEffectsForPlayer(<the unit's controller>)`, so the
 * effect must be filed under the TARGET's controller — which is the enemy player when a card hands
 * a keyword to an opposing unit (SEC_048 Captain Rex).
 */
/**
 * SEC_048 Captain Rex — "When Played/When this unit completes an attack: Give this unit and an
 * enemy unit Sentinel for this phase." Shared by both triggers.
 *
 * Rex's own grant is applied immediately rather than in the target handler: the ability is
 * mandatory and does as much as it can, so with no enemy on the board he still gains Sentinel and
 * there is simply nothing to prompt for.
 */
export function buildCaptainRexSentinel(
  player: PlayerId,
  playId: string | undefined,
  continuation: PendingResolution | null,
): PendingResolution | null {
  const gameLog = GetGame()?.gameLog ?? [];
  const rex = playId ? GetUnitInPlay(playId, player) : null;
  if (rex) GrantKeywordForPhase("SEC_048", rex, gameLog, "Sentinel");

  const enemies = GetUnitsForPlayer(player === 1 ? 2 : 1);
  if (enemies.length === 0) return continuation;
  return {
    type: "ability-target",
    cardId: "SEC_048",
    player,
    sourcePlayId: playId,
    fromPlayIds: enemies.map(u => u.playId),
    continuation,
  } as PendingResolution;
}

export function GrantKeywordForPhase(
  sourceCardId: string,
  target: Unit,
  gameLog: string[],
  keywordName: string,
): void {
  const gs = GetGameState();
  gs.currentEffects.push({
    cardId: sourceCardId,
    duration: "Phase",
    affectedPlayer: target.controller,
    targetPlayId: target.playId,
  });
  gameLog.push(`${CardTitle(sourceCardId)}: gave ${keywordName} to ${CardTitle(target.cardId)} for this phase.`);
}

export function GiveStatModForPhase(
  sourceCardId: string,
  target: Unit,
  amount: number,
  gameLog: string[],
): void {
  const gs = GetGameState();
  gs.currentEffects.push({
    cardId: PHASE_STAT_MOD,
    duration: "Phase",
    affectedPlayer: target.controller,
    targetPlayId: target.playId,
    value: amount,
  });
  const sign = amount >= 0 ? "+" : "–";
  const mag = Math.abs(amount);
  gameLog.push(`${CardTitle(sourceCardId)}: gave ${sign}${mag}/${sign}${mag} to ${CardTitle(target.cardId)} for this phase.`);
}

/**
 * Gives a unit a +X/+0 (or –X/–0, when `amount` is negative) power-only modifier. Sibling of
 * GiveStatModForPhase for cards that move power without touching HP; `duration` lets the same
 * helper serve "for this phase" and "for this attack" cards.
 */
/**
 * Gives `target` an HP-only modifier (+0/+X or –0/–X). The counterpart of GivePowerMod — used by
 * cards whose buff must not raise power, e.g. Chirrut Îmwe (SOR_004) "+0/+2 for this phase".
 */
export function GiveHpMod(
  sourceCardId: string,
  target: UnitInterface,
  amount: number,
  duration: EffectDuration,
  gameLog: string[],
): void {
  const gs = GetGameState();
  gs.currentEffects.push({
    cardId: HP_MOD,
    duration,
    affectedPlayer: target.controller,
    targetPlayId: target.playId,
    value: amount,
  });
  gameLog.push(`${CardTitle(sourceCardId)}: ${CardTitle(target.cardId)} gets +0/${amount >= 0 ? "+" : ""}${amount}.`);
}

export function GivePowerMod(
  sourceCardId: string,
  target: UnitInterface,
  amount: number,
  duration: EffectDuration,
  gameLog: string[],
): void {
  const gs = GetGameState();
  gs.currentEffects.push({
    cardId: POWER_MOD,
    duration,
    affectedPlayer: target.controller,
    targetPlayId: target.playId,
    value: amount,
  });
  const sign = amount >= 0 ? "+" : "–";
  const scope = duration === "ForAttack" ? "this attack" : "this phase";
  gameLog.push(`${CardTitle(sourceCardId)}: gave ${sign}${Math.abs(amount)}/+0 to ${CardTitle(target.cardId)} for ${scope}.`);
}

export function GetHand(player: PlayerId): Card[] {
  const game = GetGame();
  if (!game) {
    return [];
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return playerObj.hand;
}

/**
 * Returns true if the given card IDs collectively have at least the specified aspect icons.
 * aspects may contain duplicates (e.g. ["Aggression", "Aggression"] requires two icons).
 */
export function CardsCanDisclose(cardIds: string[], aspects: string[]): boolean {
  const required: Record<string, number> = {};
  for (const a of aspects) required[a] = (required[a] ?? 0) + 1;
  const available: Record<string, number> = {};
  for (const id of cardIds) {
    for (const a of CardAspects(id)) available[a] = (available[a] ?? 0) + 1;
  }
  for (const [aspect, count] of Object.entries(required)) {
    if ((available[aspect] ?? 0) < count) return false;
  }
  return true;
}

/**
 * Returns true if the player's hand collectively has at least the specified aspect icons.
 * aspects may contain duplicates (e.g. ["Aggression", "Aggression"] requires two Aggression icons).
 */
export function CanDisclose(player: PlayerId, aspects: string[]): boolean {
  return CardsCanDisclose(GetHand(player).map(c => c.cardId), aspects);
}

/** The five aspects Leia (SEC_004) may disclose — Villainy is deliberately not among them. */
export const SEC_004_ASPECTS = ["Vigilance", "Command", "Aggression", "Cunning", "Heroism"];

/** The six card aspects — the options for LAW_101 Lawbringer's "Choose an aspect". */
export const LAWBRINGER_ASPECTS = ["Vigilance", "Command", "Aggression", "Cunning", "Heroism", "Villainy"];

/** True when the player's hand holds a card carrying at least one of the given aspects. */
export function CanDiscloseAnyOf(player: PlayerId, aspects: string[]): boolean {
  return GetHand(player).some(c => CardAspects(c.cardId).some(a => aspects.includes(a)));
}

/** Units sharing no aspect at all with the disclosed card. */
export function UnitsNotSharingAspectWith(disclosedCardId: string): Unit[] {
  const disclosed = new Set(CardAspects(disclosedCardId));
  return AllUnits().filter(u => !CardAspects(u.cardId).some(a => disclosed.has(a)));
}

/** How many DIFFERENT aspects a card has (Command,Heroism → 2; Command,Command → 1). */
export function DistinctAspectCount(cardId: string): number {
  return new Set(CardAspects(cardId)).size;
}

/** The number of different card costs among the cards in a player's discard pile. */
export function DistinctCostsInDiscard(player: PlayerId): number {
  const game = GetGame();
  if (!game) return 0;
  const pState = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return new Set(pState.discard.map(d => CardCost(d.cardId) ?? 0)).size;
}

/** The set of different aspects across all units a player controls. */
export function DistinctAspectsAmongUnits(player: PlayerId): Set<string> {
  const aspects = new Set<string>();
  for (const unit of GetUnitsForPlayer(player)) {
    for (const aspect of CardAspects(unit.cardId)) aspects.add(aspect);
  }
  return aspects;
}

/** True when the player's discard pile contains at least one card with the given aspect. */
export function PlayerHasAspectInDiscard(player: PlayerId, aspect: string): boolean {
  const game = GetGame();
  if (!game) return false;
  const pState = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return pState.discard.some(c => CardAspects(c.cardId).includes(aspect));
}

export function UnitWasDefeatedThisPhase(player: PlayerId, trait?: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const defeatedUnits = game.currentGameState.roundState.cardsLeftPlayThisPhase.filter(defeated => defeated.fromPlayer === player && (defeated.reason === "defeated" || defeated.reason === "token-defeated"));
  if (trait) {
    return defeatedUnits.some(defeated => TraitContains(defeated.cardId, trait));
  }

  return defeatedUnits.length > 0;
}

export function UnitsDefeatedThisPhaseCount(player: PlayerId): number {
  const game = GetGame();
  if (!game) return 0;
  return game.currentGameState.roundState.cardsLeftPlayThisPhase.filter(
    d => d.fromPlayer === player && (d.reason === "defeated" || d.reason === "token-defeated"),
  ).length;
}

export function UnitAttackedThisPhase(player: PlayerId, trait?: string, another?: boolean, playId?: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  let attackedUnits = game.currentGameState.roundState.unitsAttackedThisPhase.filter(attacked => attacked.fromPlayer === player);

  if (another && !playId) {
    throw new Error("playId is required when another is true");
  }

  if (another && playId) {
    attackedUnits = attackedUnits.filter(attacked => attacked.playId !== playId);
  }

  if (trait) {
    /*
      not relevant now, but keep in mind that if a unit loses the Force trait during an attack,
      it will be "put" in this array with its original traits; will only be relevant if Nameless Terror
      becomes meta and some future card requires a Force unit to attack
    */
    return attackedUnits.some(attacked => TraitContains(attacked.cardId, trait));
  }

  return attackedUnits.length > 0;
}

/**
 * PlayIds of units that attacked this phase (either player) and are still in play, optionally
 * filtered to a trait. Used by cards that reference "a unit that attacked this phase"
 * (JTL_004 Rose Tico — a Vehicle unit; LOF_005 Morgan Elsbeth — a friendly unit).
 */
export function AttackedThisPhasePlayIds(opts: { trait?: string; player?: PlayerId } = {}): string[] {
  const game = GetGame();
  if (!game) return [];
  let attacked = game.currentGameState.roundState.unitsAttackedThisPhase;
  if (opts.player) attacked = attacked.filter(a => a.fromPlayer === opts.player);
  if (opts.trait) attacked = attacked.filter(a => TraitContains(a.cardId, opts.trait!));
  const inPlay = new Set(AllUnits().map(u => u.playId));
  return attacked.filter(a => inPlay.has(a.playId)).map(a => a.playId);
}

export function CardWasPlayedThisPhase(player: PlayerId, trait?: string, type?: CardTypes): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playedCards = game.currentGameState.roundState.cardsPlayedThisPhase.filter(played => played.fromPlayer === player);
  if (trait) {
    return playedCards.some(played => TraitContains(played.cardId, trait));
  }

  if (type) {
    return playedCards.some(played => CardType(played.cardId) === type);
  }

  return playedCards.length > 0;
}

/**
 * Upgrades that can't be defeated by an OPPONENT's card abilities — e.g. Luke Skywalker
 * (JTL_012) deployed as a Pilot. Their own controller's abilities can still defeat them,
 * and combat/unit defeat still removes them with the unit.
 */
export function UpgradeImmuneToEnemyAbilities(upgradeCardId: string): boolean {
  return upgradeCardId === "JTL_012";
}

/**
 * Upgrades whose text is "Attached unit can't ready" — a persistent restriction, not a one-off
 * exhaust. Listed here so every readying path shares one definition.
 */
const CANT_READY_UPGRADES = [
  "SHD_193", // Frozen in Carbonite
  "LAW_077", // Shadow of Stygeon Prime
];

/**
 * True when this unit is allowed to ready right now. Two things forbid it:
 *  - SOR_186 No Good to Me Dead — "that unit can't ready this round" (tracked as a Round effect);
 *  - an attached "can't ready" Condition such as Frozen in Carbonite (SHD_193).
 *
 * Every path that readies a unit already in play must consult this; readying is otherwise
 * scattered across dozens of per-card cases with no shared gate.
 */
export function CanUnitReady(
  gs: GameState,
  unit: { playId: string; upgrades: Array<{ cardId: string }> },
): boolean {
  if (gs.currentEffects.some(e => e.cardId === "SOR_186_no_ready" && e.targetPlayId === unit.playId)) {
    return false;
  }
  return !unit.upgrades.some(u => CANT_READY_UPGRADES.includes(u.cardId));
}

/**
 * Readies a unit that is already in play, unless something forbids it (see CanUnitReady).
 * Returns true when the unit actually readied. Units *entering* play ready bypass this — they
 * are not being readied, they arrive ready.
 */
export function ReadyUnit(
  gs: GameState,
  unit: { playId: string; upgrades: Array<{ cardId: string }>; ready: boolean },
): boolean {
  if (!CanUnitReady(gs, unit)) return false;
  unit.ready = true;
  return true;
}

/** Readies the unit with this playId, if it is still in play and allowed to ready. */
export function ReadyUnitByPlayId(playId: string | undefined, player: PlayerId, fromCardId?: string): void {
  if (!playId) return;
  const unit = GetUnitsForPlayer(player).find(u => u.playId === playId);
  if (!unit) return;
  const game = GetGame();
  if (!game) {
    unit.ready = true;
    return;
  }
  if (!ReadyUnit(game.currentGameState, unit)) return;
  const prefix = fromCardId ? `${CardTitle(fromCardId)}: ` : "";
  game.gameLog.push(`${prefix}readied ${CardTitle(unit.cardId)}.`);
}

/** True when `captor` has at least one enemy non-leader unit in its arena to capture. */
export function CaptureVictimsExistFor(captor: UnitInterface): boolean {
  const game = GetGame();
  if (!game) return false;
  const arena = (CardArena(captor.cardId) ?? "Ground") as "Ground" | "Space";
  const enemy: PlayerId = captor.controller === 1 ? 2 : 1;
  const enemyState = enemy === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const units = arena === "Ground" ? enemyState.groundArena : enemyState.spaceArena;
  return units.some(u => !CardIsLeader(u.cardId) && !UnitImmuneToEnemyCapture(u));
}

/** The upgrade with this playId, wherever it is attached, or null. */
export function FindUpgradeByPlayId(playId: string): CardInPlay | null {
  for (const unit of AllUnits()) {
    const upgrade = unit.upgrades.find(u => u.playId === playId);
    if (upgrade) return upgrade;
  }
  return null;
}

/** Upgrade playIds `player` may legally target with a "defeat an upgrade" ability. */
export function DefeatableUpgradePlayIds(player: PlayerId): string[] {
  return AllUnits().flatMap(u =>
    u.upgrades
      .filter(upg => !(UpgradeImmuneToEnemyAbilities(upg.cardId) && u.controller !== player))
      .map(upg => upg.playId),
  );
}

/**
 * JTL_143 Devastator: "You assign all indirect damage you deal to opponents."
 * Normally the player *receiving* indirect damage chooses how to spread it; while this
 * player controls a Devastator, they assign the damage they deal instead.
 */
export function PlayerAssignsOwnIndirectDamage(player: PlayerId): boolean {
  return GetUnitsForPlayer(player).some(
    u => u.cardId === "JTL_143" && !Unit.FromInterface(u).LostAbilities(),
  );
}

/**
 * JTL_165 Hunting Aggressor: "Indirect damage you deal to opponents is increased by 1."
 * Only applies to damage aimed at an opponent — self-assigned indirect damage is unmodified.
 */
export function IndirectDamageBonus(sourcePlayer: PlayerId, targetPlayer: PlayerId): number {
  if (sourcePlayer === targetPlayer) return 0;
  return GetUnitsForPlayer(sourcePlayer).filter(
    u => u.cardId === "JTL_165" && !Unit.FromInterface(u).LostAbilities(),
  ).length;
}

/**
 * The single entry point for "deal N indirect damage to <targetPlayer>" (CR 8.35).
 *
 * Applies the amount modifiers once, here, so every card agrees on the number. When the target
 * controls no units there is nothing to divide the damage among — CR 8.35.1 says it is assigned
 * among "any number of their units or their base", so with no units it all lands on the base and
 * no prompt is shown.
 *
 * Returns the pending the victim (or, with Devastator/Targeting Computer, the dealer) must answer,
 * or `continuation` when the damage was applied outright.
 */
export function buildIndirectDamage(
  sourceCardId: string,
  sourcePlayer: PlayerId,
  targetPlayer: PlayerId,
  amount: number,
  continuation: PendingResolution | null,
  sourcePlayId?: string,
): PendingResolution | null {
  const gs = GetGameState();
  const total = amount + IndirectDamageBonus(sourcePlayer, targetPlayer);
  if (total <= 0) return continuation;

  const units = GetUnitsForPlayer(targetPlayer);
  if (units.length === 0) {
    DealDamageToBase(gs, targetPlayer, total, sourcePlayer);
    GetGame()?.gameLog.push(
      `${CardTitle(sourceCardId)}: ${total} indirect damage — Player ${targetPlayer} has no units, so it all hits their base.`,
    );
    return continuation;
  }

  return {
    type: "indirect-damage",
    cardId: sourceCardId,
    sourcePlayer,
    targetPlayer,
    totalDamage: total,
    eligibleUnitPlayIds: units.map(u => u.playId),
    sourcePlayId,
    continuation,
  } as PendingResolution;
}

/**
 * JTL_171 Targeting Computer: attached unit gains "You assign all indirect damage dealt by this
 * unit." Per-unit, unlike Devastator's player-wide version.
 */
export function UnitAssignsOwnIndirectDamage(playId: string | undefined, player: PlayerId): boolean {
  if (!playId) return false;
  const unit = GetUnitInPlay(playId, player);
  if (!unit || unit.LostAbilities()) return false;
  return unit.upgrades.some(u => u.cardId === "JTL_171");
}

export function LeaderCanDeployAsPilot(cardId: string): boolean {
  switch(cardId) {
    case "JTL_001"://Asajj Ventress
    case "JTL_003"://Lando Calrissian
    case "JTL_006"://Darth Vader
    case "JTL_008"://Wedge Antilles
    case "JTL_009"://Boba Fett
    case "JTL_011"://Major Vonreg
    case "JTL_012"://Luke Skywalker
    case "JTL_015"://Rio Durant
    case "JTL_017"://Han Solo
    case "JTL_018"://Kazuda Xiono
      return true;
    default: return false;
  }
}

/**
 * Cards with a "When you draw this card during the action phase" ability. Queued from the single
 * draw chokepoint below rather than checked at each of the many call sites.
 */
const WHEN_DRAWN_CARDS = new Set(["LOF_148"]); // Rey — With Palpatine's Power

/**
 * Queues a "when you draw this card" trigger. Called from EVERY route a card can travel from
 * deck to hand — DrawCardForPlayer is the obvious one, but a deck search that draws (Recruit
 * SOR_123, Grand Moff Tarkin…) pushes to hand directly and would otherwise miss the trigger.
 */
export function QueueWhenDrawnTrigger(gs: GameState, player: PlayerId, cardId: string): void {
  // "During the action phase" — the regroup draw must not trigger it.
  if (gs.gamePhase !== "ActionPhase" || !WHEN_DRAWN_CARDS.has(cardId)) return;
  gs.triggerBag.push({
    triggerType: "when-card-drawn",
    cardId,
    fromPlayer: player,
    nested: true,
  });
}

/** Cards with a "When this card is discarded from your hand or deck" reaction. */
const WHEN_DISCARDED_CARDS = new Set(["LAW_206"]); // That's a Rock

/**
 * Queues a "when this card is discarded from your hand or deck" trigger. Call from EVERY site
 * that moves a card from a player's HAND or DECK to the discard pile — hand-discard pendings,
 * random discards, deck mills, reveal-then-discard flows. Do NOT call it for a played event
 * finishing resolution or for defeated units/upgrades/resources: those are not discards from
 * hand or deck.
 */
export function QueueWhenDiscardedTrigger(gs: GameState, owner: PlayerId, cardId: string): void {
  if (!WHEN_DISCARDED_CARDS.has(cardId)) return;
  gs.triggerBag.push({
    triggerType: "when-discarded",
    cardId,
    fromPlayer: owner,
    nested: true,
  });
}

/**
 * Records that `player` drew a card this phase. Called from EVERY route that puts a card into
 * hand off the deck, not just DrawCardForPlayer — the deck-search "draw" path bypasses that
 * function entirely, and a card counting draws would silently under-count without this.
 */
export function MarkCardDrawn(gs: GameState, player: PlayerId, count = 1): void {
  gs.roundState.cardsDrawnThisPhase[player] += count;
}

/** How many cards `player` has drawn this phase. */
export function CardsDrawnThisPhase(player: PlayerId): number {
  const gs = GetGameState();
  return gs.roundState.cardsDrawnThisPhase[player] ?? 0;
}

export function DrawCardForPlayer(gs: GameState, log: string[], player: PlayerId): void {
  const p = player === 1 ? gs.player1 : gs.player2;
  if (p.deck.length > 0) {
    const drawn = p.deck.pop()!;
    p.hand.push(drawn);
    MarkCardDrawn(gs, player);
    log.push(`Player ${player} drew a card.`);
    // Queued rather than returned: DrawCardForPlayer has many callers, none of which can handle
    // a pending, so the trigger bag carries it to the end of the current dispatch.
    QueueWhenDrawnTrigger(gs, player, drawn.cardId);
    return;
  }
  {
    p.base.damage += 3;
    QueueWhenBaseDamagedReaction(gs, player, 3);
    log.push(`Player ${player} drew from an empty deck — 3 damage to their base.`);
  }
}

export function FisherYatesShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

/**
 * Constant "this unit can't attack" restrictions (CR: declaring an attack is illegal).
 * A unit that has lost its abilities also loses the restriction — "can't attack" is itself
 * an ability, so silencing the unit frees it to attack.
 */
export function CanUnitAttack(unit: UnitInterface): boolean {
  const asUnit = Unit.FromInterface(unit);
  if (asUnit.LostAbilities()) return true;

  switch (unit.cardId) {
    case "LOF_063": //Oggdo Bogdo — "can't attack unless it's damaged"
      return asUnit.IsDamaged();
    case "LOF_044": //Loth-Wolf — "This unit can't attack."
    case "JTL_059": //Corporate Defense Shuttle — "This unit can't attack."
      return false;
    default:
      return true;
  }
}

export function HasOnAttack(cardId: string, player?: PlayerId, playId?: string): boolean {
  if (player && playId) {
    const unit = GetUnitInPlay(playId, player);
    if (unit) {
      if (unit.LostAbilities()) return false;
      //current effects that grant on-attack abilities
      for(const currentEffect of GetCurrentEffectsForPlayer(unit.controller)) {
        if (currentEffect.targetPlayId && currentEffect.targetPlayId !== playId) continue;

        if (EffectGrantsOnAttack(currentEffect.cardId)) {
          return true;
        }
      }

      //upgrades that grant on-attack abilities
      for(const upgrade of unit.upgrades) {
        if(UpgradeGrantsOnAttack(upgrade.cardId, player, upgrade.playId)) {
          return true;
        }
      }

      //Support: the attacker gained the supporting unit's On Attack ability for this attack.
      const supported = SupportGrantedCardId(playId, player);
      if (supported && HasOnAttack(supported)) return true;
    }
  }

  // TWI_165 Kit Fisto — "Coordinate — On Attack: ..." The On Attack exists only while Coordinate
  // is active (3+ friendly units), so it is gated here rather than listed as innate below.
  if (cardId === "TWI_165") return player !== undefined && IsCoordinateActive(player);

  //cards with innate on-attack abilities
  switch (cardId) {
    case "SEC_011": //Governor Pryce (deployed) — On Attack: create a Spy token
    case "SEC_204": //Blue Ace — On Attack: ready an exhausted enemy unit
    case "SEC_197": //Furtive Handmaiden — On Attack: may discard a card from hand; if you do, draw
    case "LAW_101": //Lawbringer — On Attack: choose an aspect, give enemy units with it –2/–2
    case "SOR_017": //Han Solo (deployed) — On Attack: resource the top card of your deck (ready), then defeat a resource next action phase
    case "SHD_009": //Hunter (deployed) — On Attack: may reveal a resource; if it shares a name with a friendly unique unit, swap it for the top of your deck
    case "SEC_015": //C-3PO (deployed) — On Attack: if you control another exhausted unit, may exhaust a unit
    case "LAW_051": //Beilert Valance — On Attack: draw, then may deal damage equal to draws
    case "LAW_048": //Chio Fain — On Attack: may have both players each draw a card
    case "LOF_037": //Darth Vader — On Attack: defeat an enemy unit with a Shield token on it
    case "ASH_009": //Ahsoka Tano (deployed) — On Attack: may give a weaker unit +2/+0 this phase
    case "ASH_014": //The Mandalorian (deployed) — On Attack: may draw a card with the initiative
    case "ASH_059": //Leia Organa (ASH) — On Attack: may self-damage to heal your base
    case "ASH_072": //Doctor Pershing — On Attack: draw a card if it has 3+ remaining HP
    case "ASH_099": //Gozanti Assault Carrier — On Attack: gains Sentinel for this phase
    case "TWI_015": //General Grievous (deployed) — On Attack: may give a Droid unit +1/+0 and Sentinel
    case "ASH_156": //R5-D4 — On Attack: defeat all upgrades on the defending unit
    case "ASH_168": //Migs Mayfeld — On Attack: deal 1 (2 if upgraded) damage to the defending unit
    case "ASH_203": //Mando's N-1 Starfighter — On Attack: may exhaust your leader for +2/+0
    case "ASH_209": //Ezra Bridger — On Attack: if upgraded, may give a unit –3/–0 this phase
    case "ASH_253": //Yellow Aces Bomber — On Attack: if upgraded, deal 2 damage to a base
    case "ASH_179": //Boba Fett's Rancor — On Attack: may deal 1 damage to a base for every 5 damage on your base
    case "ASH_196": //Gorian Shard's Corsair — On Attack: may deal 2 damage to a unit
    case "ASH_189": //Emperor's Messenger — On Attack: Ready a resource.
    case "LAW_057": //Benthic "Two Tubes" — On Attack: 1 damage to an enemy ground unit
    case "LOF_135": //Scythe — On Attack: may give another friendly Inquisitor +2/+0 this phase
    case "LOF_129": //Acolyte of the Beyond — On Attack: the Force is with you
    case "LAW_011": //Darth Vader (deployed) — On Attack: discard any number, deal that much damage
    case "TWI_246": //Tranquility — On Attack: next 3 Republic cards this phase cost 1 less
    case "LAW_214": //Boba Fett (For a Price) — On Attack: may pay 1 to deal 3 to a ground unit
    case "ASH_248": //Neel — On Attack: next unit with 1 or less power enters play ready
    case "SEC_188": //Darth Traya — On Attack: may ready a non-unit leader
    case "SEC_004": //Leia Organa (SEC, deployed) — On Attack: may disclose, then give an XP token
    case "LOF_002": //Mother Talzin (deployed) — On Attack: may give a unit -1/-1 this phase
    case "JTL_004": //Rose Tico (deployed) — On Attack: may heal 2 damage from a Vehicle unit
    case "LOF_005": //Morgan Elsbeth (deployed) — On Attack: next keyword-sharing unit costs 1 less
    case "LOF_009": //Darth Maul (deployed) — On Attack: deal 1 to a unit and 1 to a different unit
    case "LOF_014": //Grand Inquisitor (deployed) — On Attack: defender gets -2/-0 for this attack
    case "LOF_015": //Cal Kestis (deployed) — On Attack: opponent exhausts a ready unit they control
    case "JTL_010": //Captain Phasma (deployed) — On Attack: if First Order played, may deal 1 to a unit + 1 to a base
    case "JTL_147": //Black One — On Attack: if you control Poe Dameron, may deal 1 damage to a unit
    case "JTL_151": //Red Five — On Attack: may deal 2 damage to a damaged unit
    case "LOF_045": //Yaddle — On Attack: each other friendly Jedi gains Restore 1 this phase
    case "SEC_087": //Dedra Meero — On Attack: create a Spy token
    case "JTL_133": //Allegiant General Pryde — On Attack: if you have initiative, 2 indirect damage
    case "JTL_149": //Red Squadron Y-Wing — On Attack: 3 indirect damage to the defending player
    case "SHD_153": //Poe Dameron — On Attack: discard up to 3, then one different option per discard
    case "SHD_064": //Survivors' Gauntlet — When Played/On Attack: may move an upgrade between units of the same controller
    case "SHD_150": //Koska Reeves — On Attack: if upgraded, may deal 2 damage to a ground unit
    case "SHD_139": //Krrsantan — On Attack: may deal 1 damage to a ground unit per damage on this unit
    case "SHD_091": //Jabba's Rancor — When Played/On Attack: 3 damage to another friendly ground unit and 3 to an enemy ground unit
    case "SEC_244": //Darth Nihilus — When Played/On Attack: 3 damage to the lowest-HP other unit
    case "LOF_082": //Vaneé — When Played/On Attack
    case "LOF_003": //Ahsoka Tano (deployed) — On Attack: may give a friendly unit Sentinel
    case "SOR_179": //Boba Fett - Disintegrator
    case "SOR_040": //Avenger - Hunting Star Destroyer
    case "SOR_188": //Chopper
    case "SOR_047": //Kanan Jarrus
    case "SOR_050": //The Ghost - Spectre Home Base
    case "SOR_119": //Reinforcement Walker
    case "SOR_059": //2-1B Surgical Droid
    case "SOR_116": //Steadfast Battalion (General Grievous)
    case "SOR_158": //Jedha Agitator (Cassian Andor)
    case "SOR_208": //Outer Rim Headhunter (Swoop Racer)
    case "SOR_244": //Snowspeeder (Concord Dawn Interceptors)
    case "SOR_236": //R2-D2 - Ignoring Protocol
    case "SOR_206": //Mining Guild TIE Fighter
    case "SOR_006": //Emperor Palpatine - Galactic Ruler
    case "LAW_013": //Chewbacca - Hero of Kessel (deployed)
    case "JTL_018": //Kazuda Xiono - Best Pilot in the Galaxy (deployed)
    case "JTL_008": //Wedge Antilles - Leader of Red Squadron (deployed)
    case "SOR_005": //Luke Skywalker - Faithful Friend (deployed)
    case "SOR_007": //Grand Moff Tarkin - Ruthless Strategist (deployed)
    case "SOR_011": //Grand Inquisitor - Hunting the Jedi (deployed)
    case "SHD_003": //Finn - This is a Rescue (deployed)
    case "SHD_004": //Rey - More Than a Scavenger (deployed)
    case "SOR_010": //Darth Vader - Dark Lord of the Sith
    case "SOR_014": //Sabine Wren - Galvanized Revolutionary
    case "SHD_012": //Bo-Katan Kryze - Princess in Exile
    case "TWI_005": //Count Dooku - Face of the Confederacy
    case "TWI_186": //San Hill - Chairman of the Banking Clan
    case "SEC_085": //Vice Admiral Rampart - On Schedule
    case "SEC_065": //Nala Se - Chief Medical Scientist
    case "SOR_142": //Explosives Artist - Sabine Wren
    case "SOR_131": //Fifth Brother
    case "SOR_056": //Bendu
    case "SEC_110": //GNK Power Droid
    case "SOR_067": //Rugged Survivors
    case "LAW_079": //K-2SO — On Attack: may deal 3 damage to a damaged ground unit
    case "ASH_043": //Corona Four — On Attack: may give a unit -2/-0 for this phase
    case "ASH_056": //Huyang — On Attack: may give an upgraded unit -4/-0 for this phase
    case "ASH_083": //Summa-verminoth — On Attack: defeat all other space units
    case "JTL_186": //Mist Hunter — On Attack: if you played a Bounty Hunter or Pilot card this phase, may draw
    case "LAW_173": //BT-1 — On Attack: discard top of deck; if Aggression, may deal 1 to a ground unit
    case "LAW_174": //0-0-0 — On Attack: may put an Aggression card from discard on deck bottom; deal 1 to each enemy base
    case "LAW_238": //Scavenging Sandcrawler
    case "JTL_056": //Hondo Ohnaka - You Cannot Run From Your Name
    case "TWI_094": //Shaak Ti - Unity Wins Wars
    case "SOR_008": //Hera Syndulla (deployed) — On Attack: may give an XP token to another unique unit
    case "TWI_002": //Nute Gunray (deployed) — On Attack: create a Battle Droid token
    case "TWI_006": //Wat Tambor (deployed) — On Attack: if a friendly unit was defeated this phase, may give +2/+2
    case "TWI_014": //Asajj Ventress (deployed) — On Attack: if you played an event this phase, +1/+0 and first strike
    case "ASH_132": //Queen Soruna — On Attack: may reveal a unit from hand to deal 3 damage to a unit with the same cost
    case "ASH_146": //Justifier — On Attack: may deal 1 damage to a unit; if defeated, give an Advantage token to a unit
    case "ASH_149": //Eviscerator — On Attack: give 2 Advantage tokens to each other friendly unit
    case "ASH_157": //Danger Squadron Wingmen — On Attack: may give an Advantage token to another unit
    case "ASH_172": //Razor Crest — On Attack: may discard a card from hand for +2/+0 this attack
    case "IBH_006": //Rebellion Y-Wing — On Attack: deal 1 damage to a base
    case "IBH_024":
    case "IBH_032":
    case "IBH_010": //Han Solo — On Attack: the defender gets -2/-0 for this attack
    case "IBH_042":
    case "IBH_060": //Admiral Piett — On Attack: if you control an Aggression unit, draw a card
    case "IBH_065":
    case "IBH_053": //Darth Vader (deployed) — On Attack: deal 2 damage to a base
    case "IBH_001": //Leia Organa (deployed) — On Attack: heal 1 from a friendly unit and 1 from another
      return true;
    default: break;
  }

  return false;
}

export function EffectGrantsOnAttack(cardId: string): boolean {
  switch (cardId) {
    case "JTL_156": //Trench Run
    case "LOF_205": //Force Speed
    case "LAW_169": //Payroll Heist
      return true;
    default: break;
  }

  return false;
}

export function UpgradeGrantsOnAttack(cardId: string, player?: PlayerId, playId?: string): boolean {
  if (player && playId) {
    //for conditional on-attack abilities granted by upgrades
    //TODO: example Jedi Lightsaber

    // Luke Skywalker (Hero of Yavin) as a Pilot upgrade only grants the On Attack
    // "If it's a Fighter" — a piloted Transport or Capital Ship gains nothing.
    if (cardId === "JTL_012") {
      const attached = GetUnitsForPlayer(player).find(u => u.upgrades.some(upg => upg.playId === playId));
      if (!attached) return false;
      return CardTraits(attached.cardId).includes("Fighter");
    }
  }

  switch (cardId) {
    case "JTL_008": //Wedge Antilles piloting — grants "On Attack: next Pilot card costs 1 less."
    case "JTL_046": //Paige Tico piloting — grants "On Attack: XP to this unit, then 1 damage to it."
    case "SHD_175": //Armed to the Teeth — grants "On Attack: Give another friendly unit +2/+0 for this phase."
    case "SHD_126": //The Darksaber
    case "SHD_177": //Vambrace Flamethrower
    case "SOR_121": //Hardpoint Heavy Blaster
    case "SOR_214": //Smuggling Compartment
    case "SOR_054": //Jedi Lightsaber (conditional: only fires if attached unit is Force)
    case "SOR_137": //Fallen Lightsaber (conditional: only fires if attached unit is Force)
    case "LOF_138": //Sith Holocron — grants "On Attack: may deal 2 to a friendly unit for +2/+0"
    case "LOF_139": //Battle Fury — grants "On Attack: Discard a card from your hand."
    case "SEC_264": //Clandestine Connections
    case "SEC_210": //Stolen Starpath Unit — grants "On Attack: name a card, reveal, make Spies"
    case "JTL_018": //Kazuda Xiono piloting — grants his On Attack to the attached Vehicle
    case "JTL_142": //Darth Vader (Scourge of Squadrons) piloting — 1 damage, then 1 more on a kill
      return true;
    default: return false;
  }
}

export function GetPlayer(game: GameState, player: PlayerId): PlayerState {
  return player === 1 ? game.player1 : game.player2;
}

export function GetOtherPlayer(player: PlayerId): PlayerId {
  return player === 1 ? 2 : 1;
}

export function GetAllUnits(game: GameState): Unit[] {
  return [
    ...game.player1.groundArena,
    ...game.player1.spaceArena,
    ...game.player2.groundArena,
    ...game.player2.spaceArena,
  ] as Unit[];
}

/** All units from both arenas of both players. Requires active game singleton. */
export function AllUnits(): Unit[] {
  return GetAllUnits(GetGameState());
}

/** All ground units from both players. Requires active game singleton. */
export function AllGroundUnits(): Unit[] {
  const gs = GetGameState();
  return [...gs.player1.groundArena, ...gs.player2.groundArena] as Unit[];
}

/** All space units from both players. Requires active game singleton. */
export function AllSpaceUnits(): Unit[] {
  const gs = GetGameState();
  return [...gs.player1.spaceArena, ...gs.player2.spaceArena] as Unit[];
}

/** All units that have the given aspect (e.g. "Villainy", "Vigilance"). */
export function UnitsWithAspect(aspect: string): Unit[] {
  return AllUnits().filter(u => CardAspects(u.cardId).includes(aspect));
}

export function GetUnitByPlayId(game: GameState, playId: string): Unit | null {
  return GetAllUnits(game).find((u) => u.playId === playId) ?? null;
}

/**
 * Applies one-shot damage prevention (LOF_220 Shien Flurry: "the next time it would be dealt
 * damage this phase, prevent 2 of that damage") to a damage instance about to hit `targetPlayId`.
 * Returns the reduced amount, and consumes the effect the first time a real (>0) instance occurs.
 * Applied BEFORE any Shield absorption, so a fully-prevented instance leaves a Shield token intact.
 */
export function ApplyDamagePrevention(gs: GameState, targetPlayId: string, amount: number, log?: string[]): number {
  if (amount <= 0) return amount;

  // JTL_193 I Have You Now: "Prevent ALL damage that would be dealt to it during this attack."
  // Unlike the one-shot below it is not consumed here — it covers every damage instance of the
  // attack and is cleared by the ForAttack cleanup when the attack ends.
  if (gs.currentEffects.some(e => e.cardId === "JTL_193_prevent" && e.targetPlayId === targetPlayId)) {
    if (log) {
      const shielded = GetUnitByPlayId(gs, targetPlayId);
      log.push(`${CardTitle("JTL_193")}: prevented ${amount} damage to ${shielded ? CardTitle(shielded.cardId) : "a unit"}.`);
    }
    return 0;
  }

  const idx = gs.currentEffects.findIndex(e => e.cardId === "LOF_220_prevent" && e.targetPlayId === targetPlayId);
  if (idx === -1) return amount;
  const prevent = gs.currentEffects[idx].value ?? 0;
  gs.currentEffects.splice(idx, 1); // one-shot — consumed on the next damage instance
  const reduced = Math.max(0, amount - prevent);
  const prevented = amount - reduced;
  if (prevented > 0 && log) {
    const target = GetUnitByPlayId(gs, targetPlayId);
    log.push(`${CardTitle("LOF_220")}: prevented ${prevented} damage to ${target ? CardTitle(target.cardId) : "a unit"}.`);
  }
  return reduced;
}

/**
 * Card ids granting a unit immunity to enemy card abilities, whether printed on the unit itself or
 * granted by an attached Pilot upgrade. Empty once the unit loses its abilities — the protection is
 * an ability like any other (LAW_132 The Tree Remembers strips it).
 *
 * Combat is not a card ability, so combat still damages/defeats these units — every immunity vector
 * routes through a card ability's target selection or DealDamageToUnit, never through combat.
 */
function ImmunityGrants(unit: UnitInterface): string[] {
  if (Unit.FromInterface(unit).LostAbilities()) return [];
  const grants: string[] = [];
  // SHD_187 Lurking TIE Phantom — "can't be captured, damaged, or defeated by enemy card abilities."
  if (unit.cardId === "SHD_187") grants.push("SHD_187");
  // JTL_103 Chewbacca (Faithful First Mate) — "can't be defeated or returned to hand by enemy card
  // abilities", printed on the unit and granted to the vehicle it pilots.
  if (unit.cardId === "JTL_103" || unit.upgrades?.some(u => u.cardId === "JTL_103")) grants.push("JTL_103");
  return grants;
}

/** Units enemy card abilities can't DAMAGE. */
export function UnitImmuneToEnemyDamage(unit: UnitInterface): boolean {
  return ImmunityGrants(unit).includes("SHD_187");
}

/** Units enemy card abilities can't DEFEAT. */
export function UnitImmuneToEnemyDefeat(unit: UnitInterface): boolean {
  return ImmunityGrants(unit).length > 0;
}

/** Units enemy card abilities can't CAPTURE. */
export function UnitImmuneToEnemyCapture(unit: UnitInterface): boolean {
  return ImmunityGrants(unit).includes("SHD_187");
}

/** Units enemy card abilities can't RETURN TO HAND. */
export function UnitImmuneToEnemyBounce(unit: UnitInterface): boolean {
  return ImmunityGrants(unit).includes("JTL_103");
}

/**
 * ASH_196 Gorian Shard's Corsair: "Damage dealt by friendly Underworld cards is unpreventable."
 * True when `sourceController` controls a live ASH_196 and the damage-dealing card
 * (`sourceCardId`) has the Underworld trait — checked at every prevention/Shield hook (combat and
 * DealDamageToUnit) so the damage bypasses Shield tokens and other prevention effects (e.g.
 * LOF_220 Shien Flurry).
 */
export function DamageIsUnpreventable(sourceCardId: string, sourceController: PlayerId, sourcePlayId?: string): boolean {
  if (!TraitContains(sourceCardId, "Underworld", sourceController, sourcePlayId)) return false;
  return GetUnitsForPlayer(sourceController).some(
    u => u.cardId === "ASH_196" && !Unit.FromInterface(u).LostAbilities(),
  );
}

/**
 * Puts the top card of `player`'s deck into play as a resource. Shared by every "put the top card
 * of your deck into play as a resource" card. Pass `ready` for the cards that add "and ready it".
 * Returns false when the deck is empty — the rest of such an ability still resolves.
 */
/**
 * Removes a resource from `player`'s row, preserving how many resources they have AVAILABLE.
 *
 * Resource readiness is fungible in paper: the cards sit facedown and are interchangeable, so a
 * player paying costs always arranges for the resource an effect takes away to be an exhausted
 * one. Splicing a READY resource out directly would quietly cost them an available resource that
 * a physical game never would — so when the removed one was ready, an exhausted resource is
 * readied in its place. With nothing exhausted to trade, the ready slot is genuinely lost.
 *
 * Use this for any effect that takes a resource OUT of the row without charging a cost for it
 * (returning it to hand, and so on). Cost-paying paths like Smuggle handle the same asymmetry by
 * discounting the cost instead.
 *
 * The returned resource carries the state it ACTUALLY left in: when a trade happened, the card
 * that physically departs is the exhausted one, so `ready` comes back false. Callers that hand the
 * card to another player (SHD_213 DJ returning a stolen resource) can pass it straight on.
 *
 * Returns the removed resource, or null when `playId` is not in that player's row.
 */
export function RemoveResourcePreservingReady(
  gs: GameState,
  player: PlayerId,
  playId: string,
): Resource | null {
  const pState = GetPlayer(gs, player);
  const idx = pState.resources.findIndex(r => r.playId === playId);
  if (idx === -1) return null;
  const [removed] = pState.resources.splice(idx, 1);
  if (removed.ready) {
    const exhausted = pState.resources.find(r => !r.ready);
    if (exhausted) {
      exhausted.ready = true;
      removed.ready = false; // the card handed over is the one that was exhausted
    }
  }
  return removed;
}

export function ResourceTopCardOfDeck(
  gs: GameState,
  player: PlayerId,
  gameLog: string[],
  sourceCardId: string,
  opts: { ready?: boolean } = {},
): boolean {
  const pState = GetPlayer(gs, player);
  const top = pState.deck.pop();
  if (!top) {
    gameLog.push(`${CardTitle(sourceCardId)}: deck is empty — no resource put into play.`);
    return false;
  }
  pState.resources.push({
    cardId: top.cardId,
    playId: String(gs.nextPlayId++),
    owner: player,
    controller: player,
    ready: opts.ready ?? false,
    stolen: false,
  });
  gameLog.push(`${CardTitle(sourceCardId)}: put ${CardTitle(top.cardId)} into play as a${opts.ready ? " ready" : "n exhausted"} resource.`);
  return true;
}

/**
 * `player` discards one card chosen at random from their hand. Shared by every "discards a random
 * card from their hand" card (SOR_190 Lothal Insurgent, LOF_227 The Will of the Force). No-op on an
 * empty hand.
 */
export function DiscardRandomCardFromHand(
  gs: GameState,
  player: PlayerId,
  gameLog: string[],
  sourceCardId: string,
): void {
  const pState = GetPlayer(gs, player);
  if (pState.hand.length === 0) return;
  const idx = Math.floor(Math.random() * pState.hand.length);
  const [discarded] = pState.hand.splice(idx, 1);
  pState.discard.push({
    cardId: discarded.cardId,
    playId: String(gs.nextPlayId++),
    owner: player,
    controller: player,
    turnDiscarded: gs.currentRound,
    discardEffect: "",
  });
  QueueWhenDiscardedTrigger(gs, player, discarded.cardId);
  gameLog.push(`${CardTitle(sourceCardId)}: Player ${player} discarded ${CardTitle(discarded.cardId)} at random.`);
}

/** Records that a unit took damage this phase (e.g. ASH_188 Galvanized Leap's "was damaged this phase"). */
export function MarkUnitDamaged(gs: GameState, playId: string): void {
  gs.roundState.unitsDamagedThisPhase ??= [];
  if (!gs.roundState.unitsDamagedThisPhase.includes(playId)) {
    gs.roundState.unitsDamagedThisPhase.push(playId);
  }
}

export function DealDamageToUnit(gs: GameState, cardId: string, targetPlayId: string|undefined, amount: number, withLog?: string[], sourcePlayer?: PlayerId): void {
  if (!targetPlayId) return;
  const target = GetUnitByPlayId(gs, targetPlayId);
  if (!target) return;
  if (amount <= 0) return;
  // ASH_150 Deadly Vulnerability: the attached unit takes twice as much damage. Applied before
  // prevention and Shield so downstream absorption sees the doubled instance.
  if (target.upgrades.some(u => u.cardId === "ASH_150")) amount *= 2;
  // Immunity to enemy card abilities: all DealDamageToUnit is ability damage (combat damage is
  // applied directly in resolveAttack, never here). Prevent unless the source is the unit's own
  // controller. `sourcePlayer` is undefined for most callers, so enemy AoE/targeted damage is
  // blocked by default; a friendly effect must pass sourcePlayer to damage its own immune unit.
  if (UnitImmuneToEnemyDamage(target) && sourcePlayer !== target.controller) {
    if (withLog) withLog.push(`${CardTitle(target.cardId)} can't be damaged by enemy card abilities.`);
    return;
  }
  // ASH_196: damage from a friendly Underworld card bypasses all prevention, including Shields.
  const unpreventable = sourcePlayer !== undefined && DamageIsUnpreventable(cardId, sourcePlayer);
  // Shien Flurry prevention applies before the Shield, so a fully-prevented hit spares the Shield.
  if (!unpreventable) amount = ApplyDamagePrevention(gs, targetPlayId, amount, withLog);
  if (amount <= 0) return;
  // Shield token absorbs the entire instance of damage: prevent it and defeat one Shield token.
  const shieldIdx = unpreventable ? -1 : target.upgrades.findIndex(u => u.cardId === "SOR_T02");
  if (shieldIdx !== -1) {
    target.upgrades.splice(shieldIdx, 1);
    if (withLog) {
      withLog.push(`${CardTitle(target.cardId)}'s Shield token was defeated, preventing ${amount} damage.`);
    }
    return;
  }
  target.damage += amount;
  MarkUnitDamaged(gs, target.playId);
  if (withLog) {
    withLog.push(`${CardTitle(cardId)}: dealt ${amount} damage to ${CardTitle(target.cardId)}.`);
  }

  // Jango Fett (TWI_016): a unit dealing ability damage to an enemy unit counts as "a friendly unit
  // deals damage to an enemy unit". (Combat damage is applied in resolveAttack and hooked there.)
  // Attribute to the source unit's controller when `cardId` is a unit in play on the enemy side of
  // the target — i.e. a real friendly-vs-enemy hit, not a friendly self-damage effect.
  if (CardType(cardId) === "Unit") {
    const sourceUnit = [
      ...gs.player1.groundArena, ...gs.player1.spaceArena,
      ...gs.player2.groundArena, ...gs.player2.spaceArena,
    ].find(u => u.cardId === cardId && u.controller !== target.controller);
    if (sourceUnit) QueueJangoDamageReaction(gs, sourceUnit.controller, target.playId);
  }

  // Rancor Keeper (ASH_032): "When a friendly unit is dealt damage and survives" — ability damage path.
  QueueRancorKeeperReaction(gs, target);
}

/**
 * ASH_032 Rancor Keeper: "When a friendly unit is dealt damage and survives: Deal 1 damage to any
 * number of bases. Use this ability only once each round." Queues the trigger when `damaged`
 * (already carrying its post-damage HP) belongs to a player controlling a live Rancor Keeper that
 * hasn't used the ability this round. Called after damage lands, from both the ability-damage path
 * (DealDamageToUnit) and the combat-damage path (resolveAttack).
 */
export function QueueRancorKeeperReaction(gs: GameState, damaged: Unit): void {
  if (damaged.CurrentHP() <= 0) return; // must survive
  const controller = damaged.controller;
  const keeper = GetUnitsForPlayer(controller).find(u => u.cardId === "ASH_032");
  if (!keeper) return;
  if (Unit.FromInterface(keeper).LostAbilities()) return;
  const usedThisRound = gs.currentEffects.some(
    e => e.cardId === "ASH_032_usedThisRound" && e.affectedPlayer === controller,
  );
  if (usedThisRound) return;
  gs.triggerBag.push({ triggerType: "when-unit-takes-damage", cardId: "ASH_032", fromPlayer: controller, playId: damaged.playId, nested: true });
}

/**
 * Generic "when your base is dealt damage" dispatch (WhenBaseDamagedContext). Base damage is not
 * centralized — every call site that increments a base's damage total calls this immediately
 * after, so any card with a "When your base is dealt damage" reaction (currently only ASH_204
 * Blade Three) hooks in without each site needing its own per-card check. One trigger per
 * instance of damage applied (not per point) — call this once per application site regardless of
 * `amount`, mirroring how QueueRancorKeeperReaction/QueueJangoDamageReaction fire once per hit.
 */
export function QueueWhenBaseDamagedReaction(gs: GameState, targetPlayer: PlayerId, amount: number): void {
  if (amount <= 0) return;
  const reactive = GetUnitsForPlayer(targetPlayer).filter(
    u => u.cardId === "ASH_204" && !Unit.FromInterface(u).LostAbilities(),
  );
  for (const u of reactive) {
    gs.triggerBag.push({
      triggerType: "when-base-damaged",
      cardId: "ASH_204",
      fromPlayer: targetPlayer,
      playId: u.playId,
      context: { sourcePlayer: targetPlayer, damageTaken: amount },
      nested: true,
    });
  }
}

/**
 * TWI_016 Jango Fett: "When a friendly unit deals damage to an enemy unit: You may exhaust this
 * leader (deployed: no cost). If you do, exhaust that enemy unit." Queues the optional reaction when
 * a unit controlled by `sourceController` deals damage to `damagedPlayId` (an enemy unit). The
 * damaged unit rides on the trigger's `playId`. Fires for either the leader side (undeployed, ready)
 * or the deployed side (a TWI_016 unit in play). Shared by the combat and ability damage paths.
 */
export function QueueJangoDamageReaction(gs: GameState, sourceController: PlayerId, damagedPlayId: string): void {
  const pState = sourceController === 1 ? gs.player1 : gs.player2;
  const leaderSide = pState.leader.cardId === "TWI_016" && !pState.leader.deployed && pState.leader.ready;
  const deployedSide = [...pState.groundArena, ...pState.spaceArena].some(u => u.cardId === "TWI_016");
  if (!leaderSide && !deployedSide) return;
  gs.triggerBag.push({ triggerType: "when-unit-deals-damage", cardId: "TWI_016", fromPlayer: sourceController, playId: damagedPlayId, nested: true });
}

/** Builds a pending where the opponent of `player` chooses one of their own units to defeat. */
export function chooseAndDefeatUnit(
  cardId: string,
  player: PlayerId,
  includeLeaders: boolean,
  continuation: PendingResolution | null = null,
): AbilityTargetPending | null {
  const game = GetGame();
  if (!game) throw new Error("Game not found in chooseAndDefeatUnit");
  const opponent = GetOtherPlayer(player);
  const opponentUnits = GetUnitsForPlayer(opponent).filter(u => !UnitImmuneToEnemyDefeat(u));
  const eligible = includeLeaders ? opponentUnits : opponentUnits.filter(u => !CardIsLeader(u.cardId));
  if (eligible.length === 0) return null;
  return {
    type: "ability-target",
    cardId,
    player,
    fromPlayIds: eligible.map(u => u.playId),
    continuation,
  };
}

/**
 * Builds an ability-option → ability-target pending for "you may do X to a target" effects.
 * Only use when onYes is a target-selection step. Cases where onYes has inline effects
 * (no target needed) remain hand-written.
 */
export function optionalTarget(
  cardId: string,
  player: PlayerId,
  fromPlayIds: string[],
  helperText: string,
  opts: {
    yesLabel?: string;
    noLabel?: string;
    sourcePlayId?: string;
    continuation?: PendingResolution | null;
  } = {},
): AbilityOptionPending {
  return {
    type: "ability-option",
    cardId,
    player,
    sourcePlayId: opts.sourcePlayId,
    helperText,
    yesLabel: opts.yesLabel ?? "Yes",
    noLabel: opts.noLabel ?? "Skip",
    onYes: {
      type: "ability-target",
      cardId,
      player,
      // Carried through to the target step: an ability whose effect acts on its own source
      // ("…this unit gets +2/+0") has no other way to find it once the option is answered.
      sourcePlayId: opts.sourcePlayId,
      fromPlayIds,
      continuation: opts.continuation ?? null,
    } satisfies AbilityTargetPending,
    continuation: opts.continuation ?? null,
  } satisfies AbilityOptionPending;
}

/**
 * "You may pay 1 resource. If you do, <effect>." — a whole family of LAW cards (Boba Fett LAW_214,
 * Shield Drive Outfitter, Dogged Pursuers, Hidden Hand Supplier…) share this exact opening.
 *
 * Builds only the offer; the payment and the "if you do" half live together in the engine's
 * `_pay1` option handler, so the resource can never be spent without the effect following. Returns
 * null when the player cannot afford it — the ability then simply does not trigger, which is also
 * why the affordability test counts Credit tokens alongside ready resources.
 */
export function optionalPayResource(
  cardId: string,
  player: PlayerId,
  helperText: string,
  opts: { sourcePlayId?: string; continuation?: PendingResolution | null } = {},
): AbilityOptionPending | null {
  const gs = GetGameState();
  const p = player === 1 ? gs.player1 : gs.player2;
  const spendable = p.resources.filter(r => r.ready).length + (p.supplemental.creditTokens ?? 0);
  if (spendable < 1) return null;
  return {
    type: "ability-option",
    cardId: `${cardId}_pay1`,
    player,
    sourcePlayId: opts.sourcePlayId,
    helperText,
    yesLabel: "Pay 1",
    noLabel: "Skip",
    onYes: null, // the engine pays and builds the follow-up, so it cannot be split apart
    continuation: opts.continuation ?? null,
  } satisfies AbilityOptionPending;
}

/** Builds a simple ability-target pending for mandatory target-selection effects. */
/**
 * Chains `times` independent target prompts for one ability — "For each X, <do something>
 * to a unit" (the TS26 bases).
 *
 * Deliberately a chain rather than a single multi-select: each iteration chooses "a unit"
 * on its own, so the same unit may legally be picked every time. A multi-select would force
 * distinct targets. Built inside-out, so the innermost prompt carries `continuation`.
 */
export function repeatTargetPrompt(
  cardId: string,
  player: PlayerId,
  fromPlayIds: string[],
  times: number,
  continuation: PendingResolution | null = null,
): PendingResolution | null {
  if (times <= 0 || fromPlayIds.length === 0) return continuation;
  let chain: PendingResolution | null = continuation;
  for (let i = 0; i < times; i++) chain = mandatoryTarget(cardId, player, fromPlayIds, chain);
  return chain;
}

/**
 * repeatTargetPrompt's optional twin — "For each X, you MAY <do something> to a unit"
 * (TS26_11 Executioner's Arena). Each repetition is declined or accepted on its own.
 */
export function repeatOptionalTargetPrompt(
  cardId: string,
  player: PlayerId,
  fromPlayIds: string[],
  times: number,
  helperText: string,
  opts: { yesLabel?: string; noLabel?: string } = {},
  continuation: PendingResolution | null = null,
): PendingResolution | null {
  if (times <= 0 || fromPlayIds.length === 0) return continuation;
  let chain: PendingResolution | null = continuation;
  for (let i = 0; i < times; i++) {
    chain = optionalTarget(cardId, player, fromPlayIds, helperText, { ...opts, continuation: chain });
  }
  return chain;
}

export function mandatoryTarget(
  cardId: string,
  player: PlayerId,
  fromPlayIds: string[],
  continuation: PendingResolution | null = null,
): AbilityTargetPending {
  return {
    type: "ability-target",
    cardId,
    player,
    fromPlayIds,
    continuation,
  } satisfies AbilityTargetPending;
}

/**
 * Darth Nihilus (SEC_244) "Deal 3 damage to the unit with the least remaining HP among other
 * units. (If multiple units are tied, choose one.) If it's a non-Vehicle unit, give an Experience
 * token to this unit." Shared by his When Played and his On Attack.
 *
 * "Other units" spans both players — a friendly unit can be the lowest and is a legal target.
 * The tie clause is why this is a target prompt rather than an auto-resolve: only the units tied
 * at the minimum remaining HP are offered, so the player picks among equals and nothing else.
 * Returns `continuation` unchanged when Nihilus is the only unit in play.
 */
export function buildNihilusAbility(
  player: PlayerId,
  selfPlayId: string | undefined,
  continuation: PendingResolution | null,
): PendingResolution | null {
  const others = AllUnits().filter(u => u.playId !== selfPlayId);
  if (others.length === 0) return continuation;
  const lowest = Math.min(...others.map(u => Unit.FromInterface(u).CurrentHP()));
  const tied = others.filter(u => Unit.FromInterface(u).CurrentHP() === lowest);
  return {
    type: "ability-target",
    cardId: "SEC_244",
    player,
    sourcePlayId: selfPlayId,
    fromPlayIds: tied.map(u => u.playId),
    continuation,
  } satisfies AbilityTargetPending;
}

/**
 * Vaneé (LOF_082) "You may defeat an Experience token on a friendly unit.
 * If you do, give an Experience token to a friendly unit." Shared by When Played and On Attack.
 * Returns `continuation` unchanged when no friendly unit carries an Experience token.
 */
export function buildVaneeAbility(
  player: PlayerId,
  continuation: PendingResolution | null,
): PendingResolution | null {
  const friendly = GetUnitsForPlayer(player);
  const withXp = friendly
    .filter(u => u.upgrades.some(up => up.cardId === "SOR_T01"))
    .map(u => u.playId);
  if (withXp.length === 0) return continuation;
  return {
    type: "ability-option",
    cardId: "LOF_082",
    player,
    helperText: "Defeat an Experience token on a friendly unit, then give one to a friendly unit?",
    yesLabel: "Yes",
    noLabel: "Skip",
    onYes: {
      type: "ability-target",
      cardId: "LOF_082_defeat",
      player,
      fromPlayIds: withXp,
      continuation: {
        type: "ability-target",
        cardId: "LOF_082_give",
        player,
        fromPlayIds: friendly.map(u => u.playId),
        continuation,
      },
    },
    continuation,
  } satisfies AbilityOptionPending;
}

/**
 * "You may take control of an upgrade matching `upgradeFilter` on a unit and attach it to a
 * different eligible unit." Shared take-control mechanic (Hondo JTL_056 On Attack; Shuttle ST-149
 * JTL_242 When Played/When Defeated). Two-step resolution is handled by the generic
 * "take-control-upgrade" / "take-control-unit" dispatch cases.
 * Returns `continuation` unchanged when no matching upgrade is in play.
 */
export function buildTakeControlOfUpgrade(
  cardId: string,
  player: PlayerId,
  upgradeFilter: (upg: { cardId: string }) => boolean,
  helperText: string,
  continuation: PendingResolution | null,
): PendingResolution | null {
  const movable = AllUnits().flatMap(u =>
    u.upgrades.filter(upgradeFilter).map(upg => upg.playId));
  if (movable.length === 0) return continuation;
  return {
    type: "ability-option",
    cardId,
    player,
    helperText,
    yesLabel: "Move upgrade",
    noLabel: "Skip",
    onYes: {
      type: "ability-target",
      cardId: "take-control-upgrade",
      player,
      fromPlayIds: movable,
      continuation,
    },
    continuation,
  } satisfies AbilityOptionPending;
}

/**
 * "You may attach an upgrade on a unit to another eligible unit controlled by the SAME player"
 * (SHD_064 Survivors' Gauntlet, When Played and On Attack).
 *
 * The sibling of buildTakeControlOfUpgrade, but a pure relocation: the upgrade never changes
 * controller, and its destination must be a unit its current holder's controller controls. Only
 * upgrades that actually have somewhere legal to go are offered, so the prompt can't dead-end.
 * Resolved by the "move-upgrade-source" / "move-upgrade-dest" dispatch cases.
 */
export function buildMoveUpgradeSameController(
  cardId: string,
  player: PlayerId,
  continuation: PendingResolution | null,
): PendingResolution | null {
  const game = GetGame();
  if (!game) throw new Error("Game not found in buildMoveUpgradeSameController");
  const movable = AllUnits().flatMap(holder =>
    holder.upgrades
      .filter(upg => MoveUpgradeDestinations(upg.cardId, holder).length > 0)
      .map(upg => upg.playId));
  if (movable.length === 0) return continuation;
  return {
    type: "ability-option",
    cardId,
    player,
    helperText: "Move an upgrade to another eligible unit controlled by the same player?",
    yesLabel: "Move upgrade",
    noLabel: "Skip",
    onYes: {
      type: "ability-target",
      cardId: "move-upgrade-source",
      player,
      fromPlayIds: movable,
      continuation,
    } satisfies AbilityTargetPending,
    continuation,
  } satisfies AbilityOptionPending;
}

/**
 * Where an upgrade currently on `holder` may be moved: units the HOLDER'S controller controls
 * (never the holder itself) that the upgrade is allowed to attach to. Shared by the eligibility
 * filter above and the two resolution steps, so what is offered and what is accepted agree.
 */
export function MoveUpgradeDestinations(upgradeCardId: string, holder: UnitInterface): string[] {
  const game = GetGame();
  if (!game) return [];
  const owner = holder.controller;
  const eligible = new Set(UpgradeEligibleTargets(upgradeCardId, game.currentGameState, owner));
  return GetUnitsForPlayer(owner)
    .filter(u => u.playId !== holder.playId && eligible.has(u.playId))
    .map(u => u.playId);
}

export interface SearchDeckFilter {
  type?: string;
  aspect?: string;
  trait?: string;
  keyword?: string;
  maxCost?: number;
}

export interface SearchDeckOpts {
  filter?: SearchDeckFilter;
  dontReveal?: boolean;
  maxChoices?: number;
  maxCombinedCost?: number;
  costModifier?: 'free' | number;
  continuation?: PendingResolution | null;
}

/**
 * Builds a DeckSearchPending for any deck-search effect.
 * topN = -1 searches the entire deck. Returns null if the deck is empty or no cards pass the filter.
 */
export function searchDeck(
  cardId: string,
  player: PlayerId,
  topN: number,
  action: "draw" | "play" | "scry",
  opts?: SearchDeckOpts,
): DeckSearchPending | null {
  const game = GetGame();
  if (!game) throw new Error("Game not found in searchDeck");
  const gs = game.currentGameState;
  const deck = player === 1 ? gs.player1.deck : gs.player2.deck;
  if (deck.length === 0) return null;

  const n = topN === -1 ? deck.length : Math.min(topN, deck.length);
  const slice = deck.slice(-n);
  const topCards = slice.map((c, i) => ({ tempId: `${i}`, cardId: c.cardId }));

  const filter = opts?.filter;
  let eligibleChoices: Array<{ tempId: string; cardId: string; cost: number }>;

  if (filter) {
    eligibleChoices = topCards
      .filter(c => {
        if (filter.type && CardType(c.cardId) !== filter.type) return false;
        if (filter.aspect && !CardAspects(c.cardId).includes(filter.aspect)) return false;
        if (filter.trait && !CardTraits(c.cardId).includes(filter.trait)) return false;
        if (filter.keyword && !HasKeyword(c.cardId, filter.keyword)) return false;
        if (filter.maxCost !== undefined && (CardCost(c.cardId) ?? 0) > filter.maxCost) return false;
        return true;
      })
      .map(c => ({ ...c, cost: CardCost(c.cardId) ?? 0 }));

    if (eligibleChoices.length === 0) {
      game.gameLog.push(`${CardTitle(cardId)}: no eligible cards in top ${n}.`);
      return null;
    }
  } else {
    eligibleChoices = topCards.map(c => ({ ...c, cost: CardCost(c.cardId) ?? 0 }));
  }

  return {
    type: "deck-search",
    cardId,
    player,
    topCards,
    eligibleChoices,
    ...(opts?.dontReveal && { dontReveal: true }),
    ...(opts?.maxChoices !== undefined && { maxChoices: opts.maxChoices }),
    ...(opts?.maxCombinedCost !== undefined && { maxCombinedCost: opts.maxCombinedCost }),
    ...(opts?.costModifier !== undefined && { costModifier: opts.costModifier }),
    action,
    continuation: opts?.continuation ?? null,
  } satisfies DeckSearchPending;
}

// Aspect penalty lives in card-playability.ts (`aspectPenalty`) — the single definition shared by
// the playability check and the payment path.