import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// JTL_042 Power from Pain (Event, cost 3, Vigilance/Villainy)
//   "Give a unit +1/+0 for this phase for each damage on it."
//
// The amount is read when the event resolves — damage taken later doesn't grow the buff.

const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7

function setup(damage: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren) // not Krennic — his leader gives damaged units +1/+0
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, Cards.events.jtl.powerFromPain)
    .WithGroundUnitForPlayer(1, DURABLE, true, damage);
}

const stats = (g: GameTestAdapter) => {
  const u = Unit.FromInterface(g.state.player1.groundArena[0]);
  return { power: u.CurrentPower(), hp: u.TotalHP() };
};

describe("JTL_042 Power from Pain", () => {
  it("gives +1/+0 per damage on the unit — HP unchanged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(stats(g)).toEqual({ power: 7, hp: 7 });
    expect(g.state.currentEffects.some(e => e.duration === "Phase")).toBe(true);
  });

  it("the buff is a snapshot — more damage later doesn't grow it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    g.state.player1.groundArena[0].damage = 5;

    expect(stats(g).power).toBe(5); // 3 + 2, not 3 + 5
  });

  it("an undamaged unit may be chosen, for +0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(0).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(stats(g).power).toBe(3);
  });
});
