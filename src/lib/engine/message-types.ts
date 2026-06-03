import type { GameState } from "@/lib/engine/game";
import type { PlayerId, Zones } from "@/lib/engine/core-models";

// ---------------------------------------------------------------------------
// Outbound: resolution requests
// ---------------------------------------------------------------------------

export interface NeedsTarget {
  type: "Target";
  fromZones?: Zones[];
  fromPlayIds?: string[];
  fromIndices?: number[];
  /** Arbitrary string choices (e.g. card titles for "Name a card" prompts). */
  fromChoices?: string[];
  needsMultiple?: boolean;
  maxTargets?: number;
}

export interface NeedsOption {
  type: "Option";
  /** eg. "Do you want to collect the Bounty from {{cardId}}?" */
  helperText: string;
  options: string[]; // eg. ["Yes", "No"] or ["deal_base_damage=3", "opponent_discards_from_hand=1"]
  /** Override display label for "Yes" option (dispatch value remains "Yes"). */
  yesLabel?: string;
  /** Override display label for "No" option (dispatch value remains "No"). */
  noLabel?: string;
}

export interface NeedsPlayer {
  type: "Player";
  fromPlayers: PlayerId[];
}

export interface NeedsTrigger {
  type: "Trigger";
  fromCardIds: string[];
}

/** Plot window: player chooses which Plot card to play from resources, or passes. */
export interface NeedsPlot {
  type: "Plot";
  /** PlayIds of Plot-eligible resources the player may choose from. */
  fromPlayIds: string[];
}

/** Spread damage: player distributes totalDamage points across eligiblePlayIds simultaneously. */
export interface NeedsSpreadDamage {
  type: "SpreadDamage";
  totalDamage: number;
  /** true = "you may" — player can assign 0 OR all, never partial */
  optional: boolean;
  eligiblePlayIds: string[];
  /** Indirect damage / spread heal: base is also a valid target (use playId "playerN.base" in assignments) */
  includesBase?: boolean;
  /** Indirect damage: the player who assigns (may differ from the active player) */
  assigningPlayer?: PlayerId;
  /** "heal" = blue UI with +/- buttons and per-target heal caps; omit for standard damage */
  mode?: "heal";
}

/** Deck-search prompt: player picks from a revealed subset with a combined cost ceiling or number of choices. */
export interface NeedsDeckSearch {
  type: "DeckSearch";
  helperText: string;
  choices: Array<{ tempId: string; cardId: string; cost: number }>;
  action: "play" | "draw" | "scry";
  maxChoices?: number; // maximum number of cards the player can choose, regardless of cost
  maxCombinedCost?: number; // maximum total cost of chosen cards, regardless of number
  costModifier?: "free" | number; // applied to each chosen card, usually to make them free or reduce cost by a certain amount
  dontReveal?: boolean; // when true, chosen cards are not revealed to the opponent before being drawn/played
}

/** Hand-peek prompt: the active player sees the target hand and optionally discards a card. */
export interface NeedsPeekHand {
  type: "PeekHand";
  targetPlayer: PlayerId;
  mustDiscard: boolean;
  /** Indices of cards in the target hand that are eligible to be discarded. */
  eligibleIndices: number[];
}

export type ResolutionRequest = NeedsTarget | NeedsOption | NeedsPlayer | NeedsTrigger | NeedsPlot | NeedsSpreadDamage | NeedsDeckSearch | NeedsPeekHand;

// ---------------------------------------------------------------------------
// Inbound: dispatch types and data payloads
// ---------------------------------------------------------------------------

export type DispatchType =
  | "play-card"
  | "play-smuggle"
  | "initiate-attack"
  | "use-ability"
  | "pass-action"
  | "claim-initiative"
  | "choose-target"
  | "choose-option"
  | "choose-player"
  | "choose-trigger"
  | "regroup-resource"
  | "pass-resource";

export type PlayCardSourceZone = "Hand" | "Deck" | "Discard";

export interface PlayCardDispatchData {
  cardId: string;
  fromZone: PlayCardSourceZone;
}

export interface PlaySmuggleDispatchData {
  playId: string;
}

export interface InitiateAttackDispatchData {
  playId: string;
}

export interface UseAbilityDispatchData {
  cardId: string;
  playId?: string;
  epicAction?: boolean;
  deployLeader?: boolean;
}

export interface ChooseTargetDispatchData {
  targetZones?: Zones[];
  targetPlayers?: PlayerId[];
  targetIndices?: number[];
  targetPlayIds?: string[];
  /** For spread-damage resolutions: how much damage to assign to each unit. */
  spreadDamageAssignments?: { playId: string; damage: number }[];
}

export interface ChooseOptionDispatchData {
  option: string;
}

export interface ChoosePlayerDispatchData {
  playerId: PlayerId;
}

export interface ChooseTriggerDispatchData {
  cardId: string;
}

export interface RegroupResourceDispatchData {
  handIndex: number;
}

export type DispatchData =
  | Record<string, never>
  | PlayCardDispatchData
  | PlaySmuggleDispatchData
  | InitiateAttackDispatchData
  | UseAbilityDispatchData
  | ChooseTargetDispatchData
  | ChooseOptionDispatchData
  | ChoosePlayerDispatchData
  | ChooseTriggerDispatchData
  | RegroupResourceDispatchData;

// ---------------------------------------------------------------------------
// Inbound: dispatch envelope
// ---------------------------------------------------------------------------

export interface GameDispatch {
  dispatchId: string;
  dispatchType: DispatchType;
  dispatchData: DispatchData;
  fromPlayer: PlayerId;
  fromPlayId?: string;
}

export interface GameMessage {
  /** Unused now, reserved for future multiplayer lobby support. */
  gameId: string;
  dispatch: GameDispatch;
}

// ---------------------------------------------------------------------------
// Outbound: response envelope
// ---------------------------------------------------------------------------

export interface DispatchResponse {
  dispatchResponseId: string;
  newGameState?: GameState;
  resolutionNeeded?: ResolutionRequest;
  invalidAction?: boolean;
  invalidReason?: string;
  sentinelPlayIds?: string[];
  unitBuffs?: Record<string, { power: number; hp: number }>;
}
