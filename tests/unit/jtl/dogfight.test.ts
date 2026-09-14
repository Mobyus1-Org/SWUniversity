import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_123 Dogfight (Event, cost 1, Command)
//   "Attack with a unit, even if it's exhausted. That unit can't attack bases for this attack."
//
// Since the base is off limits, only units that have an enemy unit to attack are offered.

const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const TIE = Cards.units.sor.tieLnFighter;              // Space

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.dogfight);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_123 Dogfight", () => {
  it("an EXHAUSTED unit attacks an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, false).WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("it can't attack the base this time", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("a unit with no enemy unit to attack isn't offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithSpaceUnitForPlayer(1, TIE)       // no enemy space units — nothing to hit
        .WithGroundUnitForPlayer(2, DURABLE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(offer(g)).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("no enemy units at all — nothing to do", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("the base restriction lasts only for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.currentEffects.some(e => e.cardId.endsWith("_no_base"))).toBe(false);
  });
});
