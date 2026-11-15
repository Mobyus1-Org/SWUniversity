import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardTitle } from "@/server/engine/card-db/generated";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";

// SOR_185 Chimaera — Flagship of the Seventh Fleet (8/7 Space, cost 8, Cunning/Villainy)
//   "Shielded"
//   "On Attack: Name a card. An opponent reveals their hand and discards a card with that name from it."

const CHIMAERA = Cards.units.sor.chimaeraFlagship;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, CHIMAERA)
    .WithCardInHandForPlayer(2, MARINE)
    .WithCardInHandForPlayer(2, CSF)
    .WithActivePlayer(1);
}

describe("SOR_185 Chimaera — Flagship of the Seventh Fleet", () => {
  it("has Shielded", () => {
    expect(HasShielded(CHIMAERA)).toBe(true);
  });

  it("On Attack: naming a card in their hand discards it, then the attack lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(MARINE)] });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([CSF]);
    expect(g.state.player2.discard.map(c => c.cardId)).toContain(MARINE);
    expect(g.state.player2.base.damage).toBe(8);
  });

  it("naming a card they don't hold discards nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(Cards.units.sor.wolffe)] });
    if (g.lastDispatchResponse?.resolutionNeeded) await g.dispatchAsync(1, "choose-target", { targetIndices: [] });

    expect(g.state.player2.hand.length).toBe(2);
    expect(g.state.player2.base.damage).toBe(8);
  });
});
