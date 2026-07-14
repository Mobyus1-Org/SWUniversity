import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { CardInPlay } from "@/lib/engine/core-models";

// JTL_197 Anakin Skywalker — I'll Try Spinning (2/3 Ground, cost 2; as a Pilot: +2/+3)
// "Piloting [2 resources]"
// "When attached unit completes an attack (and survives): You may return this upgrade to its
//  owner's hand."

function anakinUpgrade(): CardInPlay[] {
  return [{ cardId: Cards.units.jtl.anakinSkywalker, playId: "@", owner: 1, controller: 1 }];
}

// System Patrol Craft (3/4 Space) is a Vehicle, so Anakin can pilot it.
function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
    .WithUpgradesOnSpaceUnitForPlayer(1, 0, anakinUpgrade())
    .Build();
}

function craft(g: GameTestAdapter) {
  return g.state.player1.spaceArena[0];
}

describe("JTL_197 Anakin Skywalker — as a Pilot upgrade", () => {
  it("gives the attached Vehicle +2/+3", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    const unit = Unit.FromInterface(craft(g));
    expect(unit.CurrentPower()).toBe(5); // 3 + 2
    expect(unit.TotalHP()).toBe(7); // 4 + 3
  });

  it("returns the upgrade to its owner's hand after the attached unit attacks and survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // attacking a base — the attacker always survives
    await g.chooseYesAsync(1); // return Anakin to hand

    expect(g.state.player2.base.damage).toBe(5); // the +2 counted in the attack
    expect(craft(g).upgrades).toHaveLength(0);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.jtl.anakinSkywalker)).toBe(true);
  });

  it("declining keeps the upgrade attached", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.attackWithSpaceUnitAsync(1, 0);
    const attacked = await g.chooseBaseAsync(1, 2);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(attacked.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(craft(g).upgrades).toHaveLength(1);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.jtl.anakinSkywalker)).toBe(false);
  });

  it("does not trigger when the attached unit does NOT survive the attack", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Piloted craft is 5/7 but pre-damaged to 6, so 3 counter-damage defeats it.
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft, true, 6)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, anakinUpgrade())
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(s);

    await g.attackWithSpaceUnitAsync(1, 0);
    const traded = await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0); // the attacker died
    expect(traded.lastDispatchResponse?.resolutionNeeded).toBeUndefined(); // no return prompt
    // The upgrade went to the discard with the unit, not back to hand.
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.jtl.anakinSkywalker)).toBe(false);
  });
});
