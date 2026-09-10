import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_076 Death by Droids (Event, cost 5, Vigilance)
//   "Defeat a unit that costs 3 or less. Create 2 Battle Droid tokens."
//
// The two halves are independent: the droids arrive even when nothing costs 3 or less, and the
// droids made by this event are never among the defeat targets (they don't exist yet when the
// target is chosen).

const EVENT = Cards.events.twi.deathByDroids;
const CHEAP = Cards.units.sor.battlefieldMarine;          // cost 2
const PRICEY = Cards.units.sor.consularSecurityForce;     // cost 6
const DROID = Cards.units.token.battleDroid;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, CHEAP, 14)
    .WithCardInHandForPlayer(1, EVENT);
}

const droids = (g: GameTestAdapter) => g.state.player1.groundArena.filter(u => u.cardId === DROID);

describe("TWI_076 Death by Droids", () => {
  it("defeats the chosen unit that costs 3 or less and creates 2 Battle Droids", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, CHEAP).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.discard.some(c => c.cardId === CHEAP)).toBe(true);
    expect(droids(g)).toHaveLength(2);
  });

  it("offers units on EITHER side costing 3 or less, and nothing that costs more", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, CHEAP)
        .WithGroundUnitForPlayer(2, CHEAP)
        .WithGroundUnitForPlayer(2, PRICEY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect([...(res.fromPlayIds ?? [])].sort()).toEqual(
      [g.state.player1.groundArena[0].playId, g.state.player2.groundArena[0].playId].sort(),
    );
  });

  it("still creates both droids when no unit costs 3 or less — no prompt at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, PRICEY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(droids(g)).toHaveLength(2);
  });

  it("an existing Battle Droid token (cost 0) is a legal target, but the new droids are not", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, DROID).Build());

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player2.groundArena[0].playId]);
    expect(droids(g)).toHaveLength(0); // the droids come AFTER the defeat, not before the prompt

    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(droids(g)).toHaveLength(2);
  });
});
