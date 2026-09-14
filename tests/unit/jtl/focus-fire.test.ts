import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_129 Focus Fire (Event, cost 4, Command)
//   "Choose a unit. Each friendly Vehicle unit in the same arena deals damage equal to its power
//    to that unit."
//
// Each Vehicle is a separate damage instance — a Shield stops only one of them.

const TIE = Cards.units.sor.tieLnFighter;            // 2/1 Space Vehicle
const AWING = Cards.units.jtl.phoenixSquadronAWing;  // 3/2 Space Vehicle
const WAYFARER = Cards.units.lof.hyperspaceWayfarer; // 4/10 Space Creature — not a Vehicle
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.focusFire);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_129 Focus Fire", () => {
  it("each friendly Vehicle in the arena hits the chosen unit for its power — non-Vehicles don't", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, TIE)
        .WithSpaceUnitForPlayer(1, AWING)
        .WithSpaceUnitForPlayer(1, WAYFARER)
        .WithSpaceUnitForPlayer(2, WAYFARER)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(2 + 3);
  });

  it("each Vehicle is a separate instance — a Shield stops just one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, TIE)
        .WithSpaceUnitForPlayer(1, AWING)
        .WithSpaceUnitForPlayer(2, WAYFARER)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2)])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].upgrades).toHaveLength(0);
    expect([2, 3]).toContain(g.state.player2.spaceArena[0].damage);
  });

  it("only units in an arena where you control a Vehicle can be chosen — your own included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, TIE)
        .WithSpaceUnitForPlayer(2, WAYFARER)
        .WithGroundUnitForPlayer(2, MARINE) // no friendly ground Vehicle — not offered
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect([...offer(g)].sort()).toEqual([g.state.player1.spaceArena[0].playId, g.state.player2.spaceArena[0].playId].sort());
  });

  it("no friendly Vehicle at all — nothing to choose", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
