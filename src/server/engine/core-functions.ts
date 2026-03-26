import { CardAspects, CardIsUnique, CardTitle, CardTraits, CardType } from "./card-db/generated";
import { Card, CardInPlay, CardTypes, CurrentEffect, Leader, PlayerId } from "./core-models";
import { Game } from "./game";
import { Unit } from "./unit";

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
    const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
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

  const leader = player === PlayerId.Player1 ? game.currentGameState.player1.leader : game.currentGameState.player2.leader;
  const units = player === PlayerId.Player1 ? [...game.currentGameState.player1.spaceArena, ...game.currentGameState.player1.groundArena] : [...game.currentGameState.player2.spaceArena, ...game.currentGameState.player2.groundArena];
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

  const leader = player === PlayerId.Player1 ? game.currentGameState.player1.leader : game.currentGameState.player2.leader;
  const units = player === PlayerId.Player1 ? [...game.currentGameState.player1.spaceArena, ...game.currentGameState.player1.groundArena] : [...game.currentGameState.player2.spaceArena, ...game.currentGameState.player2.groundArena];
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

  return cardInPlay as Unit;
}

export function GetUnitsForPlayer(player: PlayerId): Unit[] {
  const game = GetGame();
  if (!game) {
    return [];
  }

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return [...playerObj.spaceArena, ...playerObj.groundArena];
}

export function PlayerHasUnitInPlay(player: PlayerId, cardId: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const allUnitsInPlay = [...playerObj.spaceArena, ...playerObj.groundArena];

  return allUnitsInPlay.some(card => card.cardId === cardId);
}

export function PlayerHasUnitWithTraitInPlay(player: PlayerId, trait: string,
    another: boolean = false, playId?: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
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

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
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

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const allUnitsInPlay = [...playerObj.spaceArena, ...playerObj.groundArena];

  return allUnitsInPlay.some(unit => unit.CurrentPower() >= minimumPower);
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

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
  const arenaUnits = arena === "Space" ? playerObj.spaceArena : playerObj.groundArena;

  return arenaUnits.length;
}

export function GetPlayIdForUniqueUnitInPlay(cardId: string, player: PlayerId): string {
  if (CardIsUnique(cardId)) {
    const game = GetGame();
    if (!game) {
      return "0";
    }

    const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
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

function CardIsBase(cardId: string): boolean {
  return CardType(cardId) === "Base";
}

function CardIsLeader(cardId: string): boolean {
  return CardType(cardId) === "Leader";
}

function GetLeaderForPlayer(player: PlayerId): Leader | null {
  const game = GetGame();
  if (!game) {
    return null;
  }

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return playerObj.leader;
}

export function TraitContains(cardId: string, trait: string, player?: PlayerId, playId?: string): boolean {
  const isBase = CardIsBase(cardId);
  const isLeaderSide = CardIsLeader(cardId) && player && !GetLeaderForPlayer(player)?.deployed;
  if (playId && !isLeaderSide && !isBase) {
    const unit = GetUnitInPlay(playId, player);
    const upgrades = unit?.upgrades || [];
    for(const u of upgrades) {
      switch (u.cardId) {
        case "7687006104"://Foundling
          if(trait === "Mandalorian") return true;
          break;
        case "0545149763"://Jedi Trials
          if(trait === "Jedi" && (upgrades.length || 0) >= 4) return true;
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

  return CardTraits(cardId)?.includes(trait) ?? false;
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

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return availableOnly ? playerObj.resources.filter(resource => resource.ready) : playerObj.resources;
}

export function HasTheForce(player: PlayerId) {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;

  return playerObj.supplemental.forceToken === true;
}

export function GetHand(player: PlayerId): Card[] {
  const game = GetGame();
  if (!game) {
    return [];
  }

  const playerObj = player === PlayerId.Player1 ? game.currentGameState.player1 : game.currentGameState.player2;
  return playerObj.hand;
}

export function UnitWasDefeatedThisPhase(player: PlayerId, trait?: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const defeatedUnits = game.currentGameState.roundState.cardsDefeatedThisPhase.filter(defeated => defeated.fromPlayer === player);
  if (trait) {
    return defeatedUnits.some(defeated => TraitContains(defeated.cardId, trait));
  }

  return defeatedUnits.length > 0;
}

export function UnitAttackedThisPhase(player: PlayerId, trait?: string): boolean {
  const game = GetGame();
  if (!game) {
    return false;
  }

  const attackedUnits = game.currentGameState.roundState.unitsAttackedThisPhase.filter(attached => attached.fromPlayer === player);
  if (trait) {
    /*
      not relevant now, but keep in mind that if a unit loses the Force trait during an attack,
      it will be "put" in this array with its original traits; will only be relevant if Nameless Terror
      becomes meta and some future card requires a Force unit to attack
    */
    return attackedUnits.some(attached => TraitContains(attached.cardId, trait));
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