import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_189 Emperor's Messenger (0/3 Ground, cost 1)
// "Support (When you play this unit, you may attack with another unit. It gains this unit's other
//  abilities for this attack.)"
// "On Attack: Ready a resource."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.units.ash.emperorsMessenger);
}

function exhaustedCount(g: GameTestAdapter): number {
  return g.state.player1.resources.filter(r => !r.ready).length;
}

describe("ASH_189 Emperor's Messenger", () => {
  it("On Attack: readies a resource when it attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.emperorsMessenger).Build());
    // Exhaust two resources so there is something to ready.
    g.state.player1.resources[0].ready = false;
    g.state.player1.resources[1].ready = false;
    expect(exhaustedCount(g)).toBe(2);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(exhaustedCount(g)).toBe(1); // one readied
  });

  it("Support grants the On Attack: the supported attacker readies a resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0); // costs 1, exhausting a resource
    const exhaustedAfterPlay = exhaustedCount(g);
    expect(exhaustedAfterPlay).toBeGreaterThan(0);

    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // the Marine attacks, carrying the Messenger's On Attack
    await g.chooseBaseAsync(1, 2);

    expect(exhaustedCount(g)).toBe(exhaustedAfterPlay - 1);
    expect(g.state.player2.base.damage).toBe(3); // the Marine's own power
  });

  it("readies nothing when every resource is already ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.ash.emperorsMessenger).Build());
    expect(exhaustedCount(g)).toBe(0);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(exhaustedCount(g)).toBe(0); // no crash, nothing to ready
    expect(g.state.player2.base.damage).toBe(0); // 0 power
  });
});
