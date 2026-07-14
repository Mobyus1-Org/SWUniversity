import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { CardInPlay } from "@/lib/engine/core-models";

// JTL_245 R2-D2 — Artooooooooo! (1/4 Ground, cost 1; as a Pilot: +1/+1)
// "Piloting [0 resources]"
// "This upgrade can be played on a friendly Vehicle unit with a Pilot on it."
// "Attached unit gains: 'You may play or deploy 1 additional Pilot on this unit.'"

function pilot(cardId: string): CardInPlay {
  return { cardId, playId: "@", owner: 1, controller: 1 };
}

function setup(existingUpgrades: CardInPlay[]) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
    .WithCardInHandForPlayer(1, Cards.units.jtl.r2d2)
    .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
    .WithUpgradesOnSpaceUnitForPlayer(1, 0, existingUpgrades)
    .Build();
}

function craft(g: GameTestAdapter) {
  return g.state.player1.spaceArena[0];
}

describe("JTL_245 R2-D2 — as a Pilot upgrade", () => {
  it("gives the attached Vehicle +1/+1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([pilot(Cards.units.jtl.r2d2)]));

    const unit = Unit.FromInterface(craft(g));
    expect(unit.CurrentPower()).toBe(4); // 3 + 1
    expect(unit.TotalHP()).toBe(5); // 4 + 1
  });

  it("can be played on a Vehicle that ALREADY has a Pilot on it", async () => {
    const g = new GameTestAdapter();
    // The craft already carries Anakin (JTL_197) as its pilot — normally its only pilot slot.
    g.loadNewState(setup([pilot(Cards.units.jtl.anakinSkywalker)]));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    expect(craft(g).upgrades.map(u => u.cardId)).toContain(Cards.units.jtl.r2d2);
    expect(craft(g).upgrades).toHaveLength(2);
  });

  it("grants the attached unit 1 additional Pilot slot", async () => {
    const g = new GameTestAdapter();
    // R2 is aboard; a second pilot (Anakin) may now be played onto the same craft.
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.jtl.anakinSkywalker)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [pilot(Cards.units.jtl.r2d2)])
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    expect(craft(g).upgrades.map(u => u.cardId)).toContain(Cards.units.jtl.anakinSkywalker);
    expect(craft(g).upgrades).toHaveLength(2);
  });
});
