import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_087 Venomous Wyyyshokk (3/4 Ground, cost 3, Vigilance, Creature) —
//   "When Defeated: You may give a Weakness token to a damaged unit."
//
// Only DAMAGED units are offered, from either side.

const WYYYSHOKK = Cards.units.hmw.venomousWyyyshokk;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3
const WEAKNESS = Cards.units.token.weakness;

function setup() {
  // The Wyyyshokk (1 HP left) attacks the 3/7: the counter-attack defeats it, and the 3/7 is now damaged.
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, WYYYSHOKK, true, 3)
    .WithGroundUnitForPlayer(2, CSF)
    .WithActivePlayer(1);
}

async function attackAndDie(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
}

describe("HMW_087 Venomous Wyyyshokk", () => {
  it("When Defeated: gives a Weakness token to a damaged unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await attackAndDie(g);
    expect(g.state.player1.groundArena.length).toBe(0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].upgrades.map(u => u.cardId)).toEqual([WEAKNESS]);
  });

  it("can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await attackAndDie(g);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].upgrades.length).toBe(0);
  });

  it("does not offer an undamaged unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await attackAndDie(g);
    await g.chooseYesAsync(1);
    const marinePlayId = g.state.player2.groundArena[1].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player2.groundArena[1].upgrades.length).toBe(0);
  });
});
