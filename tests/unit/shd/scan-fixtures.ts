import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

/**
 * Shared setup for the SHD cards repaired after the 2026-11-14 "unwired ability" scan. Not a test
 * file itself (vitest only collects *.test.ts).
 */

export const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground, cost 2, non-unique
export const CSF = Cards.units.sor.consularSecurityForce;  // 3/7 Ground, cost 4
export const GUNGAN = Cards.units.hmw.grandArmyMarine;     // 2/2 Ground, cost 2
export const XWING = Cards.units.token.xWing;              // 2/2 Space token
export const XP = Cards.upgrades.token.experience;
export const SHIELD = Cards.upgrades.token.shield;

export const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });
export const count = (u: { upgrades: { cardId: string }[] }, cardId: string) => u.upgrades.filter(x => x.cardId === cardId).length;
export const power = (u: Parameters<typeof Unit.FromInterface>[0]) => Unit.FromInterface(u).CurrentPower();
export const hp = (u: Parameters<typeof Unit.FromInterface>[0]) => Unit.FromInterface(u).TotalHP();

/** P1 to act, both bases at 10 damage, 14 resources so aspect penalties never get in the way. */
export function board(leader: string = Cards.leaders.sor.leiaOrgana) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 10)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP, 10)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

export function load(state: ReturnType<GameStateBuilder["Build"]>): GameTestAdapter {
  const g = new GameTestAdapter();
  g.loadNewState(state);
  return g;
}

export async function attackBase(g: GameTestAdapter, idx = 0, arena: "ground" | "space" = "ground") {
  if (arena === "ground") await g.attackWithGroundUnitAsync(1, idx);
  else await g.attackWithSpaceUnitAsync(1, idx);
  await g.chooseBaseAsync(1, 2);
}

export async function attackUnit(g: GameTestAdapter, idx: number, targetPlayId: string, arena: "ground" | "space" = "ground") {
  if (arena === "ground") await g.attackWithGroundUnitAsync(1, idx);
  else await g.attackWithSpaceUnitAsync(1, idx);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });
}

export async function pick(g: GameTestAdapter, playIds: string[], player: 1 | 2 = 1) {
  await g.dispatchAsync(player, "choose-target", { targetPlayIds: playIds });
}

export const prompt = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded ?? null;

/** Plays a card from P1's hand, declining an Exploit offer if one comes up first. */
export async function playFromHand(g: GameTestAdapter, handIndex = 0) {
  await g.playCardFromHandAsync(1, handIndex);
  const r = g.lastDispatchResponse?.resolutionNeeded as { helperText?: string } | undefined;
  if (r?.helperText?.startsWith("Use Exploit")) await g.chooseNoAsync(1);
}
