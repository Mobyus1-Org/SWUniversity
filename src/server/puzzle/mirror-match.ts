import type { Game, GameState, PlayerState } from "@/lib/engine/game";
import type { Card, Unit as UnitState } from "@/lib/engine/core-models";
import { GetGame, SetGame } from "@/server/engine/core-functions";
import { hydrateGame } from "@/server/engine/dispatch-listener";
import { Unit } from "@/server/engine/unit";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { CardSubtitle, CardTitle } from "@/server/engine/card-db/generated";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { CountBounties } from "@/server/engine/card-db/keyword-dictionaries.ts/bounty";
import type { MirrorMatch } from "@/util/puzzle-win-condition";

// ---------------------------------------------------------------------------
// Mirror puzzles: "make your side of the table mirror your opponent's."
//
// Every check compares what is VISIBLE on the table. Units face each other by arena index (index i
// sits directly under index i on the board) and must match on card, live power and remaining HP,
// damage, ready state, keywords, upgrades and captives. Ownership is deliberately ignored: it is
// invisible, and since the opponent never acts, a Weakness the player ends up with can only come
// from their own effects — comparing owners would make a starting enemy-given Weakness unmatchable.
// Hand, deck and discard never count.
//
// Live power/keywords come from the engine, which reads the ambient game singleton, so this runs on
// a hydrated scratch copy of the state and restores whatever game was active before.
// ---------------------------------------------------------------------------

/** Keywords that matter on a unit already in play; amount keywords are compared by amount. */
const BOOLEAN_KEYWORDS = ["Sentinel", "Grit", "Overwhelm", "Saboteur", "Hidden", "Coordinate", "Support"];

/** A copy of a card is the same title AND subtitle, so reprints match. */
function identity(cardId: string): string {
  return `${CardTitle(cardId)}|${CardSubtitle(cardId) ?? ""}`;
}

/** Order-independent identity list of a unit's or base's sub-cards (upgrades, captives). */
function identities(cards: Card[] | undefined): string[] {
  return (cards ?? []).map(c => identity(c.cardId)).sort();
}

function unitSignature(u: UnitState): string {
  const unit = Unit.FromInterface(u);
  return JSON.stringify({
    card: identity(u.cardId),
    power: unit.CurrentPower(),
    hp: unit.CurrentHP(),
    damage: u.damage,
    ready: u.ready,
    silenced: unit.LostAbilities(),
    keywords: BOOLEAN_KEYWORDS.filter(k => HasKeyword(u.cardId, k, u.playId, u.controller)),
    raid: RaidAmount(u.cardId, u.playId, u.controller),
    restore: RestoreAmount(u.cardId, u.playId, u.controller),
    bounties: CountBounties(u.cardId, u.playId, u.controller),
    upgrades: identities(u.upgrades),
    captives: identities(u.captives),
  });
}

function baseSignature(p: PlayerState): string {
  return JSON.stringify({
    card: identity(p.base.cardId),
    damage: p.base.damage,
    epicActionUsed: p.base.epicActionUsed,
    upgrades: identities(p.base.upgrades),
    captives: identities(p.base.captives),
  });
}

function leaderSignature(p: PlayerState): string {
  return JSON.stringify({
    card: identity(p.leader.cardId),
    deployed: p.leader.deployed,
    // A deployed leader's ready state lives on its unit in the arena, which is compared there.
    ready: p.leader.deployed ? null : p.leader.ready,
    epicActionUsed: p.leader.epicActionUsed,
    flipped: p.leader.flipped === true,
  });
}

function resourceSignature(p: PlayerState): string {
  return JSON.stringify({ count: p.resources.length, ready: p.resources.filter(r => r.ready).length });
}

function tokenSignature(p: PlayerState): string {
  return JSON.stringify({ credits: p.supplemental.creditTokens ?? 0, force: p.supplemental.forceToken === true });
}

/** Runs `fn` with a hydrated scratch copy of `gs` as the engine's ambient game. */
function withScratchGame<T>(gs: GameState, fn: (scratch: GameState) => T): T {
  const previous = GetGame();
  const scratch: Game = { id: "", currentGameState: structuredClone(gs), gameStateHistory: [], gameLog: [] };
  hydrateGame(scratch);
  SetGame(scratch);
  try {
    return fn(scratch.currentGameState);
  } finally {
    SetGame(previous);
  }
}

/**
 * Every Mirror check for this state: one per arena position (the longer side sets the count), plus
 * the base, the leader, resources and Credit/Force tokens. `mismatches` names the failing checks.
 */
export function computeMirrorMatch(gs: GameState): MirrorMatch {
  return withScratchGame(gs, (state) => {
    const mismatches: string[] = [];
    let total = 0;

    const compare = (label: string, mine: string, theirs: string) => {
      total++;
      if (mine !== theirs) mismatches.push(label);
    };

    const arenas = [
      { label: "Ground", mine: state.player1.groundArena, theirs: state.player2.groundArena },
      { label: "Space", mine: state.player1.spaceArena, theirs: state.player2.spaceArena },
    ];
    for (const { label, mine, theirs } of arenas) {
      for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
        compare(
          `${label} ${i + 1}`,
          mine[i] ? unitSignature(mine[i]) : "",
          theirs[i] ? unitSignature(theirs[i]) : "",
        );
      }
    }

    compare("Base", baseSignature(state.player1), baseSignature(state.player2));
    compare("Leader", leaderSignature(state.player1), leaderSignature(state.player2));
    compare("Resources", resourceSignature(state.player1), resourceSignature(state.player2));
    compare("Tokens", tokenSignature(state.player1), tokenSignature(state.player2));

    return { matched: total - mismatches.length, total, mismatches };
  });
}

/**
 * For the puzzle API responses, which ship this with every state whatever the puzzle's mode. A
 * comparison that throws on some odd state must never break an ordinary puzzle's dispatch.
 */
export function mirrorMatchForResponse(gs: GameState): MirrorMatch | null {
  try {
    return computeMirrorMatch(gs);
  } catch (err) {
    console.error("mirror match failed", err);
    return null;
  }
}

export function mirrorMatched(gs: GameState): boolean {
  return computeMirrorMatch(gs).mismatches.length === 0;
}

/** Why a Mirror puzzle's starting board can't be saved, or null. */
export function mirrorSetupError(gs: GameState): string | null {
  if (identity(gs.player1.leader.cardId) !== identity(gs.player2.leader.cardId)) {
    return "Mirror needs both players to have the same leader.";
  }
  if (identity(gs.player1.base.cardId) !== identity(gs.player2.base.cardId)) {
    return "Mirror needs both players to have the same base.";
  }
  if (mirrorMatched(gs)) {
    return "Mirror needs the two sides to start different — this board already matches.";
  }
  return null;
}
