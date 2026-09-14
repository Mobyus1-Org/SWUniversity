import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_091 Apology Accepted (Event, cost 1, Command/Villainy)
//   "Defeat a friendly unit. You may give 2 Experience tokens to a unit."
//
// The Experience isn't conditional on the defeat. It belongs to the event, so it resolves before
// the defeated unit's own When Defeated.

const MARINE = Cards.units.sor.battlefieldMarine;
const SHUTTLE = Cards.units.jtl.landingShuttle; // When Defeated: you may draw a card
const XP = Cards.upgrades.token.experience;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.apologyAccepted);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];
const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

describe("JTL_091 Apology Accepted", () => {
  it("defeats a friendly unit, then may give 2 Experience tokens to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(xp(g.state.player1.groundArena[0])).toBe(2);
  });

  it("only FRIENDLY units can be the one defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(offer(g)).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("the Experience can go to an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseYesAsync(1);
    expect(offer(g)).toEqual([g.state.player2.groundArena[0].playId]); // the dead unit is gone
    await g.chooseGroundUnitAsync(2, 0);

    expect(xp(g.state.player2.groundArena[0])).toBe(2);
  });

  it("declining the Experience still defeats the unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(xp(g.state.player1.groundArena[0])).toBe(0);
  });

  it("the Experience step comes BEFORE the defeated unit's When Defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInDeckForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, SHUTTLE).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // defeat the Landing Shuttle
    const first = g.lastDispatchResponse?.resolutionNeeded as { helperText?: string };
    expect(first.helperText ?? "").toMatch(/Experience/);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    // …then Landing Shuttle's "you may draw a card".
    await g.chooseYesAsync(1);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
  });
});
