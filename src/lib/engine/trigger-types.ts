import { Base, PlayerId, Unit } from "@/lib/engine/core-models";

export type TriggerType =
  | "when-played"
  | "when-deployed"
  | "when-defeated"
  | "on-attack"
  | "on-defense"
  | "when-attack-ends"
  | "when-unit-deals-damage"
  | "when-unit-takes-damage"
  | "when-base-damaged"
  | "when-upgrade-detached"
  | "shielded"  // same timing window as when-played
  | "ambush"    // same timing window as when-played
  | "leader-reaction"

export interface TriggerEntry {
  triggerType: TriggerType;
  cardId: string;
  fromPlayer: PlayerId;
  playId?: string;  // the unit this trigger is about (e.g. for shielded)
  context?: TriggerContext;
  nested?: boolean; // true when this trigger arose during resolution of another trigger (CR 7.6.11)
}

export type TriggerContext =
  | WhenDefeatedContext
  | WhenUnitDealsDamageContext
  | WhenUnitTakesDamageContext
  | WhenBaseDamagedContext
  | WhenUpgradeDetachedContext;

export interface WhenDefeatedContext {
  defeatedUnit: Unit;
}

export interface WhenUnitDealsDamageContext {
  sourceUnit: Unit;
  target: Unit | Base;
  damageDealt: number;
}

export interface WhenUnitTakesDamageContext {
  damageSource: Unit | PlayerId;
  target: Unit;
  damageTaken: number;
}

export interface WhenBaseDamagedContext {
  sourcePlayer: PlayerId;
  damageTaken: number;
}

export interface WhenUpgradeDetachedContext {
  detachedUpgradePlayId: string;
}
