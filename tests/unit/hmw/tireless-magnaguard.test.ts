import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { DiscardPlayPermission } from "@/server/engine/card-playability";

// HMW_109 Tireless Magnaguard (5/3 Ground, cost 4, Command/Villainy) —
//   "When Defeated: If this unit had 5 or more power, for this phase you may play this unit from
//    your discard pile for free and give 2 Weakness tokens to it."
//
// "Had" is its power as it left play, so a Weakness token already on it (4 power) shuts the
// replay off. The replay is free and lands with 2 Weakness tokens: a 3/1.

const MAGNAGUARD = Cards.units.hmw.tirelessMagnaguard;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 — its counter-attack kills the 5/3
const MARINE = Cards.units.sor.battlefieldMarine;
const WEAKNESS = Cards.units.token.weakness;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 6)
    .WithGroundUnitForPlayer(1, MAGNAGUARD)
    .WithGroundUnitForPlayer(2, CSF)
    .WithActivePlayer(1);
}

async function dieAttacking(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
}

const inDiscard = (g: GameTestAdapter) => g.state.player1.discard.find(c => c.cardId === MAGNAGUARD)!;

describe("HMW_109 Tireless Magnaguard", () => {
  it("defeated at 5 power: may be replayed from the discard for free, entering with 2 Weakness tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await dieAttacking(g);
    const card = inDiscard(g);
    expect(DiscardPlayPermission(g.state, 1, card.playId)).toEqual({ free: true });

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "play-card", { cardId: MAGNAGUARD, fromZone: "Discard", playId: card.playId });

    const back = g.state.player1.groundArena.find(u => u.cardId === MAGNAGUARD)!;
    expect(back.upgrades.filter(u => u.cardId === WEAKNESS).length).toBe(2);
    expect(g.state.player1.resources.every(r => r.ready)).toBe(true); // free
  });

  it("defeated at 4 power (a Weakness token on it): no replay", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnGroundUnitForPlayer(1, 0, [up(WEAKNESS, 2)]).Build());

    await dieAttacking(g);

    expect(DiscardPlayPermission(g.state, 1, inDiscard(g).playId)).toBeNull();
  });

  it("records the permission as a per-phase grant", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await dieAttacking(g);
    const grants = g.state.roundState.discardPlayGrants.filter(x => x.source === "HMW_109");
    expect(grants.length).toBe(1);
    // discardPlayGrants is a roundState ledger, cleared with the phase like Second Chance's.
  });
});
