import { randomUUID } from "crypto";
import { processDispatch } from "@/server/engine/dispatch-listener";
import { CardCost, CardRarity } from "@/server/engine/card-db/generated";
import { SetGame } from "@/server/engine/core-functions";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import type { EngineContext, PendingResolution } from "@/server/engine/pending-resolution";
import type { GameState } from "@/lib/engine/game";
import type { GameDispatch, DispatchResponse } from "@/lib/engine/message-types";
import type { DispatchType, DispatchData } from "@/lib/engine/message-types";

/**
 * Global worst-case auto-responses for Player 2 in puzzle mode.
 *
 * Maps defeated card IDs to the option string P2 should always pick.
 * Add entries here as new cards with when-defeated choices appear in puzzles.
 */
const PUZZLE_AUTO_RESPONSES: Record<string, string> = {
  "SOR_145": "deal_base_damage=1,3", // K-2SO: deal 3 damage to opponent's base
};

const RARITY_RANK: Record<string, number> = {
  Common: 0,
  Special: 1,
  Uncommon: 2,
  Rare: 3,
  Legendary: 4,
};

/**
 * Which card P2 gives up when something forces them to discard: the cheapest one, breaking
 * ties toward the least rare, then toward the earliest hand position. Keeping their best card
 * is the worst case for the solving player, and — unlike a random pick — it makes a puzzle
 * replay identically every time, which the solver and the authored solutions depend on.
 */
function pickDiscardIndex(hand: { cardId: string }[]): number {
  let best = 0;
  for (let i = 1; i < hand.length; i++) {
    const costDelta = CardCost(hand[i].cardId) - CardCost(hand[best].cardId);
    if (costDelta < 0) { best = i; continue; }
    if (costDelta > 0) continue;

    const rarityRank = (cardId: string) => RARITY_RANK[CardRarity(cardId)] ?? 0;
    if (rarityRank(hand[i].cardId) < rarityRank(hand[best].cardId)) best = i;
  }
  return best;
}

/**
 * When an opponent (P2) effect makes them choose one of the solver's (P1) units — e.g. Raddus's
 * (JTL_104) When Defeated dealing damage — pick the target that is worst for the solver, and
 * deterministically so the puzzle replays identically:
 *
 *   1. Prefer READY units over exhausted ones. A ready unit still gets to attack this turn, so
 *      knocking it out (or degrading it) costs the solver more than hitting an already-tapped unit.
 *   2. Among the preferred set, take the highest CURRENT power (buffs/upgrades/debuffs included).
 *   3. If no unit is ready, fall back to the highest-power exhausted unit — even if some exhausted
 *      unit outpowers every ready one, the ready units are still chosen first (step 1 wins).
 *   4. Ties break toward the earliest `fromPlayIds` position, which mirrors arena order.
 *
 * Returns null if none of `fromPlayIds` resolves to a P1 unit in play.
 */
function pickOpponentTargetAmongMyUnits(
  fromPlayIds: string[],
  gameState: GameState,
): string | null {
  const myUnits = [...gameState.player1.spaceArena, ...gameState.player1.groundArena];
  const byPlayId = new Map(myUnits.map(u => [u.playId, u]));

  let best: { playId: string; ready: boolean; power: number } | null = null;
  for (const playId of fromPlayIds) {
    const raw = byPlayId.get(playId);
    if (!raw) continue;
    const ready = !!raw.ready;
    const power = Unit.FromInterface(raw).CurrentPower();
    if (
      best === null ||
      // A ready unit always beats an exhausted one, regardless of power (step 1 wins step 3).
      (ready && !best.ready) ||
      // Within the same readiness tier, higher current power wins; ties keep the earlier entry.
      (ready === best.ready && power > best.power)
    ) {
      best = { playId, ready, power };
    }
  }
  return best ? best.playId : null;
}

/**
 * When an ability makes P2 choose one of their OWN units, pick the answer that is worst for the
 * solver — and deterministically, so a puzzle replays identically.
 *
 *   "give-up"  — the unit P2 surrenders (Thrawn's capture). Losing a blocker hurts them, so they
 *                hand over the cheapest unit that isn't holding the line, i.e. the cheapest
 *                non-Sentinel. If every unit has Sentinel one must still go: the most damaged
 *                (least remaining HP), keeping the healthiest blockers up.
 *   "soak"     — the unit P2 feeds to incoming damage (Cad Bane's ping). They spend a unit that
 *                isn't a blocker and can absorb it, i.e. the non-Sentinel with the MOST remaining
 *                HP, so the damage is wasted.
 *
 * Sentinel is evaluated live (it is often conditional), and ties break toward the earliest
 * `fromPlayIds` entry, which mirrors arena order.
 */
function pickOpponentOwnUnit(
  fromPlayIds: string[],
  gameState: GameState,
  mode: "give-up" | "soak",
): string | null {
  const theirUnits = [...gameState.player2.spaceArena, ...gameState.player2.groundArena];
  const byPlayId = new Map(theirUnits.map(u => [u.playId, u]));

  type Candidate = { playId: string; sentinel: boolean; cost: number; remainingHp: number };
  const candidates: Candidate[] = [];
  for (const playId of fromPlayIds) {
    const raw = byPlayId.get(playId);
    if (!raw) continue;
    const unit = Unit.FromInterface(raw);
    candidates.push({
      playId,
      sentinel: HasSentinel(raw.cardId, raw.playId, 2),
      cost: CardCost(raw.cardId) ?? 0,
      remainingHp: unit.CurrentHP(),
    });
  }
  if (candidates.length === 0) return null;

  // Non-Sentinel units are preferred in both modes; only fall back to Sentinels if that is all
  // they have.
  const nonSentinel = candidates.filter(c => !c.sentinel);
  const pool = nonSentinel.length > 0 ? nonSentinel : candidates;

  let best = pool[0];
  for (const c of pool.slice(1)) {
    if (mode === "soak") {
      if (c.remainingHp > best.remainingHp) best = c;
      continue;
    }
    // "give-up": cheapest first; among Sentinel-only pools cost is meaningless, so the
    // least-remaining-HP rule from the card's guidance decides.
    if (nonSentinel.length > 0) {
      if (c.cost < best.cost) best = c;
    } else if (c.remainingHp < best.remainingHp) {
      best = c;
    }
  }
  return best.playId;
}

/**
 * Puzzle-mode dispatch wrapper.
 *
 * Calls processDispatch normally, then automatically resolves any Player 2
 * pending decisions using the global PUZZLE_AUTO_RESPONSES map. This lets
 * puzzles define worst-case opponent behaviour without any human input.
 *
 * Never used in real games — only /api/puzzle/dispatch and puzzle tests call this.
 */
export function processPuzzleDispatch(
  dispatch: GameDispatch,
  context: EngineContext,
): { response: DispatchResponse; context: EngineContext } {
  let result = processDispatch(dispatch, context);

  while (true) {
    const pending = result.context.pending;
    if (!pending) break;

    // resolveAutoOption may consult live unit stats (e.g. CurrentPower, which reads leaders and
    // current effects off the ambient game). processDispatch clears that ambient context on return,
    // so restore it here before we inspect the just-produced state.
    SetGame(result.context.game);
    const auto = resolveAutoOption(pending, result.context.game.currentGameState);
    if (!auto) break;

    const autoDispatch: GameDispatch = {
      dispatchId: randomUUID(),
      dispatchType: auto.dispatchType,
      dispatchData: auto.dispatchData,
      fromPlayer: 2,
    };

    result = processDispatch(autoDispatch, result.context);
  }

  return result;
}

/**
 * Returns the dispatch type + data to auto-fire for Player 2, or null if no
 * auto-response is configured for this pending.
 */
function resolveAutoOption(
  pending: PendingResolution,
  gameState: GameState,
): { dispatchType: DispatchType; dispatchData: DispatchData } | null {
  if (pending.type === "when-defeated-choice" && pending.controlledBy === 2) {
    const option = PUZZLE_AUTO_RESPONSES[pending.defeatedCardId];
    if (option && pending.options.includes(option)) {
      return { dispatchType: "choose-option", dispatchData: { option } };
    }
  }

  // An effect that makes the OPPONENT discard (e.g. K-2SO's When Defeated) is their choice
  // to make, not the human's — and the puzzle UI only ever renders the human's own hand, so
  // prompting here would send an index into the wrong hand. P2 discards for themselves.
  if (pending.type === "discard-from-hand" && pending.targetPlayer === 2) {
    const p2Hand = gameState.player2.hand;
    // No cards to discard: returning null (rather than an unsatisfiable index) stops the
    // auto-resolve loop instead of spinning on a dispatch the engine always rejects.
    if (p2Hand.length === 0) return null;
    return { dispatchType: "choose-target", dispatchData: { targetIndices: [pickDiscardIndex(p2Hand)] } };
  }

  // ASH_097 Moff Gideon (Remnant Commander) controlled by the opponent (P2): his "You may return
  // a non-unique Imperial unit from your discard to your hand" When Defeated is the opponent's
  // optional ability. Auto-skip it so the human is never prompted to resolve an enemy ability —
  // returning a card to P2's hand can't affect the solver's single action phase anyway.
  if (pending.type === "ability-option" && pending.cardId === "ASH_097" && pending.player === 2) {
    return { dispatchType: "choose-option", dispatchData: { option: "No" } };
  }

  // SHD_172 Krayt Dragon controlled by the opponent (P2): always fire and always hit the
  // human player's base — the worst-case, deterministic puzzle behaviour.
  if (pending.type === "ability-option" && pending.cardId === "SHD_172" && pending.player === 2) {
    return { dispatchType: "choose-option", dispatchData: { option: "Yes" } };
  }
  if (pending.type === "ability-target" && pending.cardId === "SHD_172" && pending.player === 2) {
    return { dispatchType: "choose-target", dispatchData: { targetPlayIds: ["player1.base"] } };
  }

  // SEC_193 Grand Admiral Thrawn: "An opponent may choose a non-leader unit they control. If they
  // do, this unit captures that unit. If they don't, ready this unit." Both halves are P2's call.
  // Giving up a unit is strictly worse for the solver than letting Thrawn ready, so P2 always
  // gives one up when they can — the engine already readies Thrawn outright when they cannot.
  if (pending.type === "ability-option" && pending.cardId === "SEC_193" && pending.player === 2) {
    return { dispatchType: "choose-option", dispatchData: { option: "Yes" } };
  }
  if (pending.type === "ability-target" && pending.cardId === "SEC_193" && pending.player === 2) {
    const targetPlayId = pickOpponentOwnUnit(pending.fromPlayIds, gameState, "give-up");
    if (targetPlayId) {
      return { dispatchType: "choose-target", dispatchData: { targetPlayIds: [targetPlayId] } };
    }
  }

  // SHD_014 Cad Bane (either side): "an opponent chooses a unit they control. Deal N damage to it."
  // P2 picks which of their own units eats it — see pickOpponentOwnUnit's "soak" mode.
  if (pending.type === "ability-target" && pending.cardId === "SHD_014" && pending.player === 2) {
    const targetPlayId = pickOpponentOwnUnit(pending.fromPlayIds, gameState, "soak");
    if (targetPlayId) {
      return { dispatchType: "choose-target", dispatchData: { targetPlayIds: [targetPlayId] } };
    }
  }

  // JTL_104 Raddus controlled by the opponent (P2): its When Defeated deals damage equal to its
  // power to one of the solver's units. Auto-pick the worst-case target — ready units first, then
  // highest current power (see pickOpponentTargetAmongMyUnits).
  if (pending.type === "ability-target" && pending.cardId === "JTL_104" && pending.player === 2) {
    const targetPlayId = pickOpponentTargetAmongMyUnits(pending.fromPlayIds, gameState);
    if (targetPlayId) {
      return { dispatchType: "choose-target", dispatchData: { targetPlayIds: [targetPlayId] } };
    }
  }

  return null;
}
