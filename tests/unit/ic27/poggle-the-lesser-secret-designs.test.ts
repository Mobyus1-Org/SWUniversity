import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_145 Poggle the Lesser — Secret Designs (3/5 Ground, cost 4, Cunning/Villainy)
//   "On Attack: You may pay 1 resource and discard a card from your hand. If you do, the next
//    card you play this phase costs 3 resources less."

const POGGLE = Cards.units.ic27.poggle;
const SWOOP = Cards.units.sor.swoopRacer;     // cost 3, Cunning
const MARINE = Cards.units.sor.battlefieldMarine;

function board(resources = 6) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithGroundUnitForPlayer(1, POGGLE);
}

const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

async function poggleAttacks(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
}

describe("IC27_145 Poggle the Lesser", () => {
  it("pay 1 + discard: the next card costs 3 less (Swoop Racer 3 → 0)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, SWOOP).Build());

    await poggleAttacks(g);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(ready(g)).toBe(5);
    await g.chooseCardFromHandAsync(1, 0); // discard the Marine

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([SWOOP]);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([MARINE]);

    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(SWOOP);
    expect(ready(g)).toBe(5);
  });

  it("the discount is spent by the next card only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(10)
      .WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, SWOOP).WithCardInHandForPlayer(1, SWOOP)
      .Build());

    await poggleAttacks(g);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    const before = ready(g);
    await g.playCardFromHandAsync(1, 0);

    expect(before - ready(g)).toBe(3);
  });

  it("declining pays nothing, discards nothing, discounts nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, SWOOP).Build());

    await poggleAttacks(g);
    await g.chooseNoAsync(1);
    expect(ready(g)).toBe(6);
    expect(g.state.player1.hand).toHaveLength(1);

    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    expect(ready(g)).toBe(3);
  });

  it("an empty hand: no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await poggleAttacks(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(ready(g)).toBe(6);
  });

  it("no resource to pay with: no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).WithCardInHandForPlayer(1, SWOOP).Build());

    await poggleAttacks(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand).toHaveLength(1);
  });
});
