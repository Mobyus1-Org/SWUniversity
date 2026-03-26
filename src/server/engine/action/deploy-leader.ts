import { CardCost } from "../card-db/generated";
import { HasShielded } from "../card-db/keyword-dictionaries.ts/shielded";
import { GetGame, GetResources, LeaderAbilitiesIgnored } from "../core-functions";
import { PlayerId } from "../core-models";
import { EntryReason } from "../game";
import { GameEffect, TriggerEntry } from "../trigger-types";
import { Unit } from "../unit";
import { QueueWhenDeployedTriggers } from "./when-played";

// ---------------------------------------------------------------------------
// Shield token
// ---------------------------------------------------------------------------

/**
 * Sentinel cardId used to represent a Shield token upgrade on a unit.
 * Shield tokens have no printed text — they simply negate the next instance of
 * damage or "defeat" targeting the unit they're attached to.
 */
export const SHIELD_TOKEN_CARD_ID = "TOKEN_SHIELD";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface DeployLeaderResult {
  /** The Unit instance pushed into the ground arena. */
  leaderUnit: Unit;
  /**
   * Deterministic effects to apply before triggers are resolved.
   * Typically contains a grant-shield entry for Shielded leaders.
   */
  effects: GameEffect[];
  /**
   * Triggered abilities queued by the deploy action (e.g. "When Deployed:").
   * Add these to game.currentGameState.triggerBag.
   */
  triggers: TriggerEntry[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Returns true if the player's leader can currently be deployed.
 *
 * Conditions (sets 1–3 standard rule):
 *   - Leader is not already deployed
 *   - Epic action has not been used
 *   - Leader abilities are not suppressed (Brain Invaders)
 *   - Player controls at least N resources (total, not just ready),
 *     where N = the leader card's printed cost
 */
export function CanDeployLeader(player: PlayerId): boolean {
  const game = GetGame();
  if (!game) return false;

  const ps = player === PlayerId.Player1
    ? game.currentGameState.player1
    : game.currentGameState.player2;
  const leader = ps.leader;

  if (leader.deployed || leader.epicActionUsed) return false;
  if (LeaderAbilitiesIgnored()) return false;

  const required = CardCost(leader.cardId) ?? 0;
  const total = GetResources(player).length;

  return total >= required;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Executes the deploy leader Epic Action against the active game singleton.
 *
 * The caller is responsible for:
 *   1. Calling CanDeployLeader() first and rejecting if false
 *   2. Generating a unique `newPlayId` for the leader unit
 *   3. Pushing result.triggers into game.currentGameState.triggerBag
 *   4. Applying result.effects to the game state
 *
 * This function handles:
 *   - Marking the leader as deployed / epic action used
 *   - Creating the leader Unit in the ground arena (enters exhausted)
 *   - Recording the entry in roundState.cardsEnteredPlayThisPhase
 *   - Granting a Shield token effect if the leader has Shielded
 *   - Queuing "When Deployed" triggers
 */
export function DeployLeader(player: PlayerId, newPlayId: string): DeployLeaderResult {
  const game = GetGame()!;
  const ps = player === PlayerId.Player1
    ? game.currentGameState.player1
    : game.currentGameState.player2;
  const leader = ps.leader;

  // -- Epic Action: mark used and flip to deployed state --
  leader.epicActionUsed = true;
  leader.deployed = true;

  // -- Create leader unit in ground arena --
  // Leaders always enter the ground arena when deployed, exhausted.
  const leaderUnit = new Unit(leader.cardId, newPlayId, player);
  leaderUnit.ready = false;
  ps.groundArena.push(leaderUnit);

  // -- Record in roundState --
  game.currentGameState.roundState.cardsEnteredPlayThisPhase.push({
    fromPlayer: player,
    cardId: leader.cardId,
    playId: newPlayId,
    reason: "deployed" as EntryReason,
  });

  // -- Shield (same timing window as "When Deployed" triggers) --
  // HasShielded without playId/player uses the self-Shielded switch block,
  // which handles the three shielded-on-deploy leaders (SOR_002, SOR_011, LOF_004)
  // and already checks LeaderAbilitiesIgnored() internally.
  const effects: GameEffect[] = [];
  if (HasShielded(leader.cardId)) {
    effects.push({ type: "grant-shield", targetPlayId: newPlayId });
  }

  // -- Queue "When Deployed:" triggers --
  const triggers = QueueWhenDeployedTriggers(leader.cardId, newPlayId, player);

  return { leaderUnit, effects, triggers };
}
