import { CardArena, CardTitle } from "@/server/engine/card-db/generated";
import { Unit } from "@/server/engine/unit";
import { GetUnitsForPlayer, QueueUnitEnteredPlayReaction, UnitsEnterPlayReady } from "@/server/engine/core-functions";
import type { GameState } from "@/lib/engine/game";
import type { PlayerId, Unit as UnitInterface } from "@/lib/engine/core-models";

/**
 * TWI_203 Chancellor Palpatine (Wartime Chancellor) — "Each token unit you create enters play
 * ready." A constant ability read at creation time, so it lives at the one chokepoint every
 * Create* helper funnels through rather than being repeated per token type.
 */
function tokensEnterReadyFor(game: GameState, player: PlayerId): boolean {
  const pState = player === 1 ? game.player1 : game.player2;
  return [...pState.groundArena, ...pState.spaceArena].some(
    u => u.cardId === "TWI_203" && !Unit.FromInterface(u).LostAbilities(),
  );
}

function spawnToken(game: GameState, player: PlayerId, cardId: string): Unit {
  const playId = String(game.nextPlayId++);
  const unit = Unit.FromInterface({
    cardId,
    playId,
    owner: player,
    controller: player,
    // TWI_203 readies tokens specifically; HMW_234 readies every friendly unit that enters play.
    ready: tokensEnterReadyFor(game, player) || UnitsEnterPlayReady(game, player, cardId),
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
  // "including token units" — HMW_171 Trap Field fires on tokens, which never reach addToArena.
  QueueUnitEnteredPlayReaction(game, unit);
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

/** ASH_T01 Mandalorian token — Shielded, so it enters play with a Shield token attached. */
export function CreateMandalorianToken(game: GameState, player: PlayerId, gameLog: string[], fromCardId?: string): Unit {
  const unit = spawnToken(game, player, "ASH_T01");
  unit.upgrades.push({
    cardId: "SOR_T02",
    playId: String(game.nextPlayId++),
    owner: player,
    controller: player,
  });
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: created Mandalorian token.`);
  } else {
    gameLog.push("Created Mandalorian token.");
  }
  return unit;
}

/** HMW_T03 Beast — a 3/3 Ground Creature token (HMW_010 Tarfful, Beast Lair, and friends). */
export function CreateBeast(game: GameState, player: PlayerId, gameLog: string[], fromCardId?: string): Unit {
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: created a Beast token.`);
  } else {
    gameLog.push("Created a Beast token.");
  }

  return spawnToken(game, player, "HMW_T03");
}

export function CreateSpy(gamestate: GameState, player: PlayerId, gameLog: string[], fromCardId?: string): Unit {
  if (fromCardId) {
    gameLog.push(`${CardTitle(fromCardId)}: created a Spy token.`);
  } else {
    gameLog.push("Created a Spy token.");
  }

  return spawnToken(gamestate, player, "SEC_T01");
}

export const ADVANTAGE_TOKEN = "ASH_T02";

/**
 * Advantage (ASH_T02) — a token upgrade giving the attached unit +1/+0 with
 * "When attached unit's attack or defense ends: Defeat this upgrade." (CR 8.15)
 * Shared by every ASH card that says "give an Advantage token to a unit".
 */
export function GiveAdvantageTokens(
  game: GameState,
  target: UnitInterface,
  count: number,
  gameLog: string[],
  fromCardId?: string,
): void {
  if (count <= 0) return;
  for (let i = 0; i < count; i++) {
    target.upgrades.push({
      cardId: ADVANTAGE_TOKEN,
      playId: String(game.nextPlayId++),
      owner: target.owner,
      controller: target.controller,
    });
  }
  const prefix = fromCardId ? `${CardTitle(fromCardId)}: ` : "";
  gameLog.push(`${prefix}gave ${count} Advantage token${count > 1 ? "s" : ""} to ${CardTitle(target.cardId)}.`);
}

/** The Experience token upgrade (+1/+1). */
const EXPERIENCE_TOKEN = "SOR_T01";
const WEAKNESS_TOKEN = "HMW_T02";

/**
 * HMW_T02 Weakness — a −1/−1 UPGRADE token (HMW_003 Doctor Hemlock, and the rest of the HMW
 * Weakness cards). Attaches like an Experience token; the stat change needs no code here because
 * UpgradePowerOf / UpgradeHpOf already read the generated maps and −1 sums like any other upgrade.
 *
 * ⚠ Unlike every other token, this one can be LETHAL: it is the only upgrade in the engine that
 * LOWERS its host's HP, so a 1-HP unit dies the moment it is attached. Callers must sweep after
 * attaching — `sweepDeadUnits` — which is why this helper does not pretend to be fire-and-forget.
 */
export function GiveWeaknessToken(
  game: GameState,
  target: UnitInterface,
  gameLog: string[],
  fromCardId?: string,
): void {
  target.upgrades.push({
    cardId: WEAKNESS_TOKEN,
    playId: String(game.nextPlayId++),
    owner: target.owner,
    controller: target.controller,
  });
  const prefix = fromCardId ? `${CardTitle(fromCardId)}: ` : "";
  gameLog.push(`${prefix}gave a Weakness token to ${CardTitle(target.cardId)}.`);
}

/** Units that do NOT already carry a Weakness token — Hemlock's leader-side target restriction. */
export function UnitsWithoutWeaknessToken(units: UnitInterface[]): UnitInterface[] {
  return units.filter(u => !(u.upgrades ?? []).some(x => x.cardId === WEAKNESS_TOKEN));
}

/**
 * Attaches `count` Experience tokens to `target`. The token is an upgrade owned and controlled by
 * whoever holds the unit, so a unit that changes hands carries its tokens with it.
 */
export function GiveExperienceTokens(
  game: GameState,
  target: UnitInterface,
  count: number,
  gameLog: string[],
  fromCardId?: string,
): void {
  if (count <= 0) return;
  for (let i = 0; i < count; i++) {
    target.upgrades.push({
      cardId: EXPERIENCE_TOKEN,
      playId: String(game.nextPlayId++),
      owner: target.owner,
      controller: target.controller,
    });
  }
  const prefix = fromCardId ? `${CardTitle(fromCardId)}: ` : "";
  gameLog.push(`${prefix}gave ${count} Experience token${count > 1 ? "s" : ""} to ${CardTitle(target.cardId)}.`);
}

/**
 * The Advantage token's own ability: it is defeated once the unit it is attached to
 * finishes attacking or defending. Called at the end of an attack for the attacker and
 * (for unit attacks) the defender. Units that took no part in the attack keep theirs.
 */
export function DefeatAdvantageTokensAfterCombat(
  units: (UnitInterface | undefined | null)[],
  gameLog: string[],
): void {
  for (const unit of units) {
    if (!unit) continue;
    // ASH_149 Eviscerator: "Advantage tokens on friendly units lose all abilities" — they
    // are no longer defeated after combat for that controller's units.
    const eviscerator = GetUnitsForPlayer(unit.controller).some(
      u => u.cardId === "ASH_149" && !Unit.FromInterface(u).LostAbilities(),
    );
    if (eviscerator) continue;
    const before = unit.upgrades.length;
    unit.upgrades = unit.upgrades.filter(u => u.cardId !== ADVANTAGE_TOKEN);
    const defeated = before - unit.upgrades.length;
    if (defeated > 0) {
      gameLog.push(`${defeated} Advantage token${defeated > 1 ? "s" : ""} on ${CardTitle(unit.cardId)} defeated after combat.`);
    }
  }
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
