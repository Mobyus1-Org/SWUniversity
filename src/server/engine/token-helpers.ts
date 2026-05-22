import { CardArena } from "@/server/engine/card-db/generated";
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

export function CreateBattleDroid(game: GameState, player: PlayerId): Unit {
  return spawnToken(game, player, "TWI_T01");
}

export function CreateCloneTrooper(game: GameState, player: PlayerId): Unit {
  return spawnToken(game, player, "TWI_T02");
}

export function CreateTieFighter(game: GameState, player: PlayerId): Unit {
  return spawnToken(game, player, "JTL_T01");
}

export function CreateXWing(game: GameState, player: PlayerId): Unit {
  return spawnToken(game, player, "JTL_T02");
}

export function CreateSpy(game: GameState, player: PlayerId): Unit {
  return spawnToken(game, player, "SEC_T01");
}
