import { CardAspects, CardCost, CardIsUnique, CardTitle, CardTraits, CardType } from "@/server/engine/card-db/generated";
import { Card, CardInPlay, CardTypes, CurrentEffect, Leader, PlayerId } from "@/lib/engine/core-models";
import { Game, GameState } from "@/lib/engine/game";
import { Unit } from "@/server/engine/unit";
import { SmuggleCost } from "@/server/engine/card-db/keyword-dictionaries.ts/smuggle";

let activeGame: Game | null = null;

export function SetGame(game: Game | null): void {
  activeGame = game;
}

export function GetGame(): Game | null {
  return activeGame;
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

export function HasTheForce(player: PlayerId) {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;

  return playerObj.supplemental.forceToken === true;
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

export function DrawCardForPlayer(gs: GameState, log: string[], player: PlayerId): void {
  const p = player === 1 ? gs.player1 : gs.player2;
  if (p.deck.length > 0) {
    p.hand.push(p.deck.pop()!);
    log.push(`Player ${player} drew a card.`);
  } else {
    p.base.damage += 3;
    log.push(`Player ${player} drew from an empty deck — 3 damage to their base.`);
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
    }
  }

  //cards with innate on-attack abilities
  switch (cardId) {
    case "SOR_006": //Emperor Palpatine - Galactic Ruler
    case "SOR_010": //Darth Vader - Dark Lord of the Sith
    case "SOR_014": //Sabine Wren - Galvanized Revolutionary
    case "SHD_012": //Bo-Katan Kryze - Princess in Exile
    case "TWI_005": //Count Dooku - Face of the Confederacy
    case "TWI_186": //San Hill - Chairman of the Banking Clan
    case "SEC_085": //Vice Admiral Rampart - On Schedule
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
  }

  switch (cardId) {
    case "SHD_126": //The Darksaber
    case "SHD_177": //Vambrace Flamethrower
    case "SOR_121": //Hardpoint Heavy Blaster
      return true;
    default: return false;
  }
}