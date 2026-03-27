import type { GameState } from "./game";
import type { PlayerId, Zones } from "./core-models";

// ---------------------------------------------------------------------------
// Outbound: resolution requests
// ---------------------------------------------------------------------------

export interface NeedsTarget {
  type: "Target";
  fromZones?: Zones[];
  fromPlayIds?: string[];
  fromIndices?: number[];
  needsMultiple?: boolean;
}

export interface NeedsOption {
  type: "Option";
  /** eg. "Do you want to collect the Bounty from {{cardId}}?" */
  helperText: string;
}

export interface NeedsPlayer {
  type: "Player";
  fromPlayers: PlayerId[];
}

export interface NeedsTrigger {
  type: "Trigger";
  fromCardIds: string[];
}

export type ResolutionRequest = NeedsTarget | NeedsOption | NeedsPlayer | NeedsTrigger;

// ---------------------------------------------------------------------------
// Inbound: dispatch types and data payloads
// ---------------------------------------------------------------------------

export type DispatchType =
  | "play-card"
  | "initiate-attack"
  | "use-ability"
  | "pass-action"
  | "claim-initiative"
  | "choose-target"
  | "choose-yes"
  | "choose-no"
  | "choose-player"
  | "choose-trigger";

export type PlayCardSourceZone = "Hand" | "Deck" | "Discard";

export interface PlayCardDispatchData {
  cardId: string;
  fromZone: PlayCardSourceZone;
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
}

export interface ChoosePlayerDispatchData {
  playerId: PlayerId;
}

export interface ChooseTriggerDispatchData {
  cardId: string;
}

/** choose-yes and choose-no use an empty payload */
export type DispatchData =
  | Record<string, never>
  | PlayCardDispatchData
  | InitiateAttackDispatchData
  | UseAbilityDispatchData
  | ChooseTargetDispatchData
  | ChoosePlayerDispatchData
  | ChooseTriggerDispatchData;

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
}
