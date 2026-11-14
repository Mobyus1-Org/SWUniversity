import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_115 Leia Organa — These Are My Friends (2/3 Ground, cost 1, Command/Heroism) —
//   "When you play another unit that costs 3 or less: Heal 1 damage from your base."
//
// Printed cost, "another" (her own entry doesn't count), and only units YOU play.

const LEIA = Cards.units.hmw.leiaOrganaTheseAreMyFriends;
const MARINE = Cards.units.sor.battlefieldMarine; // cost 2
const CSF = Cards.units.sor.consularSecurityForce; // cost 4

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 5)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism
    .TheirBase(Cards.bases.common.green30HP, 5)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

describe("HMW_115 Leia Organa — These Are My Friends", () => {
  it("heals 1 from your base when you play another unit costing 3 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, LEIA).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(4);
  });

  it("does nothing for a unit costing 4", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, LEIA).WithCardInHandForPlayer(1, CSF).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(5);
  });

  it("does not trigger on her own play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, LEIA).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(5);
  });

  it("does not trigger when the OPPONENT plays a cheap unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, LEIA)
        .FillResourcesForPlayer(2, MARINE, 14)
        .WithCardInHandForPlayer(2, MARINE)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);

    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player2.base.damage).toBe(5);
  });
});
