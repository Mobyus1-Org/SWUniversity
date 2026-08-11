import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_046 Paige Tico — Dropping the Hammer (3/2 Ground Resistance Pilot)
//   "Piloting [2 resources Vigilance Heroism]
//    Attached unit gains: 'On Attack: Give an Experience token to this unit, then deal 1 damage to it.'"
//
// The granted ability is on the HOST, self-targeting and mandatory: XP first, then 1 damage —
// order matters, since the +1/+1 from Experience can be what lets it survive its own damage.

const MARINE = Cards.units.sor.battlefieldMarine;
const PAIGE = Cards.units.jtl.paigeTico;
const AWING = Cards.units.jtl.phoenixSquadronAWing; // 3/2 Space Vehicle
const xpOn = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === Cards.upgrades.token.experience).length;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 16);
}

describe("JTL_046 Paige Tico", () => {
  it("gives the piloted unit an Experience token then 1 damage on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, AWING)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(PAIGE, 1)])
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const host = g.state.player1.spaceArena[0];
    expect(xpOn(host)).toBe(1);
    expect(host.damage).toBe(1);
  });

  it("does not fire for a unit without Paige attached (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, AWING).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const host = g.state.player1.spaceArena[0];
    expect(xpOn(host)).toBe(0);
    expect(host.damage).toBe(0);
  });

  it("the Experience token lands before the damage — a 2-HP host survives", async () => {
    const g = new GameTestAdapter();
    // A-Wing is 3/2. With 1 damage already on it, the extra point would be lethal at 2 HP —
    // but Experience makes it 4/3 first, so it lives.
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, AWING, true, 1)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(PAIGE, 1)])
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.spaceArena).toHaveLength(1);
    expect(g.state.player1.spaceArena[0].damage).toBe(2);
  });
});
