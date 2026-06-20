import { CardArena, CardTitle } from "@/server/engine/card-db/generated";
import { Unit } from "@/server/engine/unit";
import type { GameState } from "@/lib/engine/game";
import type { PlayerId } from "@/lib/engine/core-models";

function spawnToken(game: GameState, player: PlayerId, cardId: string): Unit {
  const playId = String(game.nextPlayId++);
  const unit = Unit.FromInterface({
    cardId,
    playId,
    owner: player,
    controller: player,
    ready: false,
    damage: 0,
    upgrades: [],
    captives: [],
    numUses: 1,
    isClone: false,
  });
  const arena = (CardArena(cardId) ?? "Ground") as "Ground" | "Space";
  const pState = player === 1 ? game.player1 : game.player2;
  if (arena === "Ground") pState.groundArena.push(unit);
  else pState.spaceArena.push(unit);
  return unit;
}

export function CreateBattleDroid(game: GameState, player: PlayerId, gameLog: string[], fromCardId?: string): Unit {
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: created Battle Droid token.`);
  } else {
    gameLog.push("Created Battle Droid token.");
  }

  return spawnToken(game, player, "TWI_T01");
}

export function CreateCloneTrooper(game: GameState, player: PlayerId, gameLog: string[], fromCardId?: string): Unit {
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: created Clone Trooper token.`);
  } else {
    gameLog.push("Created Clone Trooper token.");
  }

  return spawnToken(game, player, "TWI_T02");
}

export function CreateTieFighter(game: GameState, player: PlayerId, gameLog: string[], fromCardId?: string): Unit {
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: created TIE Fighter token.`);
  } else {
    gameLog.push("Created TIE Fighter token.");
  }

  return spawnToken(game, player, "JTL_T01");
}

export function CreateXWing(game: GameState, player: PlayerId, gameLog: string[], fromCardId?: string): Unit {
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: created X-Wing token.`);
  } else {
    gameLog.push("Created X-Wing token.");
  }

  return spawnToken(game, player, "JTL_T02");
}

export function CreateSpy(gamestate: GameState, player: PlayerId, gameLog: string[], fromCardId?: string): Unit {
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: created a Spy token.`);
  } else {
    gameLog.push("Created a Spy token.");
  }

  return spawnToken(gamestate, player, "SEC_T01");
}

/**
 * Credit tokens are not units — they live as a counter in the controller's
 * supplemental state. While paying resources you may defeat any number of your
 * Credits, each granting a {1R} discount.
 */
export function CreateCreditToken(game: GameState, player: PlayerId, gameLog: string[], fromCardId?: string): void {
  const pState = player === 1 ? game.player1 : game.player2;
  pState.supplemental.creditTokens = (pState.supplemental.creditTokens ?? 0) + 1;

  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: created a Credit token.`);
  } else {
    gameLog.push("Created a Credit token.");
  }
}
