import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SEC_075 Knowledge and Defense (Event, cost 3, Vigilance) —
//   "Give a unit –2/–2 for this phase."
//   "Draw a card."
//
// "A unit" is unqualified: either side, either arena. The draw is its own sentence, so it happens
// even when there is no unit to shrink.

const KAD = Cards.events.sec.knowledgeAndDefense;
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3 Ground
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 Ground

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, KAD)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithActivePlayer(1);
}

describe("SEC_075 Knowledge and Defense", () => {
  it("gives an enemy unit –2/–2 for this phase and draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    const unit = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(unit.CurrentPower()).toBe(1); // 3 − 2
    expect(unit.TotalHP()).toBe(5);      // 7 − 2
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.deck.length).toBe(0);
  });

  it("can target a friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(1);
    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(3); // control
    expect(g.state.player1.hand.length).toBe(1);
  });

  it("defeats a unit the –2/–2 brings to 0 HP, and still draws", async () => {
    const g = new GameTestAdapter();
    const state = setup().WithGroundUnitForPlayer(2, MARINE).Build();
    state.player2.groundArena[0].damage = 1; // 3/3 with 1 damage → 1/1 with 1 damage
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.hand.length).toBe(1);
  });

  it("records the –2/–2 as a Phase-duration effect", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    const effects = g.state.currentEffects.filter(e => e.targetPlayId === g.state.player2.groundArena[0].playId);
    expect(effects.length).toBe(1);
    expect(effects[0].duration).toBe("Phase");
  });

  it("with no units in play, still draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(KAD);
  });
});
