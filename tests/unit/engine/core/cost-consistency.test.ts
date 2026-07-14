import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { CardIsPlayable, playCost, pilotPlayCost } from "@/server/engine/card-playability";

// The cost stack (aspect penalty, taxes, discounts) used to be duplicated: one copy decided what
// the UI/solver offered (CardIsPlayable) and another decided what was actually charged
// (handlePlayCard). These tests pin the two together.
//
// Fixture: base Daimyo's Palace (Vigilance) + leader Sabine Wren (Aggression/Heroism).
// JTL_210 The Mandalorian — Cunning x2, cost 5, piloting cost 2.
//   Both Cunning icons are uncovered → aspect penalty 4.
//   Unit cost:  5 + 4 = 9   (7 with Bendu's -2)
//   Pilot cost: 2 + 4 = 6   (Bendu discounts the CARD cost, not the piloting cost)

function setup(resources: number, withBendu: boolean) {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.law.daimyosPalace)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resources)
    .WithCardInHandForPlayer(1, Cards.units.jtl.theMandalorianPilot)
    .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker); // a Vehicle to pilot

  // SOR_056 Bendu: the next non-Heroism, non-Villainy card costs 2 less.
  if (withBendu) {
    b.WithCurrentEffect({ cardId: Cards.units.sor.bendu, duration: "Round", affectedPlayer: 1 });
  }
  return b;
}

describe("cost stack — playability and payment agree", () => {
  it("a card-cost discount does NOT leak into the piloting cost", () => {
    const g = new GameTestAdapter();
    const state = setup(9, true).Build();
    g.loadNewState(state);

    const cardId = Cards.units.jtl.theMandalorianPilot;
    // Bendu reduces the card cost: 5 + 4 penalty - 2 = 7
    expect(playCost(g.state, 1, cardId)).toBe(7);
    // ...but the piloting cost is piloting(2) + penalty(4) = 6, untouched by Bendu.
    expect(pilotPlayCost(g.state, 1, cardId)).toBe(6);
  });

  // Regression: CardIsPlayable computed the pilot cost as `fullCost - CardCost`, which folded
  // Bendu's -2 into the "aspect penalty" and reported a pilot cost of 4 instead of 6. With 5
  // resources it therefore called the card playable while the payment path refused it.
  it("is NOT playable when neither the unit cost nor the true pilot cost is affordable", async () => {
    const g = new GameTestAdapter();
    const state = setup(5, true).Build();
    g.loadNewState(state);

    const cardId = Cards.units.jtl.theMandalorianPilot;
    expect(CardIsPlayable(g.state, 1, cardId)).toBe(false); // 5 < pilot 6, and 5 < unit 7

    // ...and the payment path agrees — this is the invariant that had broken.
    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("is playable via piloting once the true pilot cost is affordable", async () => {
    const g = new GameTestAdapter();
    const state = setup(6, true).Build();
    g.loadNewState(state);

    const cardId = Cards.units.jtl.theMandalorianPilot;
    expect(CardIsPlayable(g.state, 1, cardId)).toBe(true); // 6 >= pilot 6

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();

    // Only piloting is affordable (unit costs 7), so it goes straight to the vehicle target.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.groundArena[0].playId] });
    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === cardId)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(0); // paid exactly 6
  });
});
