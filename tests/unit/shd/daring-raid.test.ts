import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_178 / TWI_170 Daring Raid — "Deal 2 damage to a unit or base."
// Two identical printings sharing one implementation.

function setupWith(eventId: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
    .WithCardInHandForPlayer(1, eventId);
}

describe.each([
  ["SHD_178", Cards.events.shd.daringRaid],
  ["TWI_170", Cards.events.twi.daringRaid],
])("Daring Raid (%s)", (_id, eventId) => {
  it("deals 2 damage to a chosen unit", async () => {
    const g = new GameTestAdapter();
    const s = setupWith(eventId).WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build();
    g.loadNewState(s);
    const targetPlayId = s.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("deals 2 damage to the enemy base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setupWith(eventId).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("can deal 2 to your own base ('a base' — either one)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setupWith(eventId).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.damage).toBe(2);
  });

  // Regression: the UI picks a base via the zone form (targetZones/targetPlayers), not a
  // "playerN.base" playId. Daring Raid must honour that path too, or bases become untargetable.
  it("deals 2 to the enemy base when chosen via the zone form (chooseBaseAsync)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setupWith(eventId).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // targetZones:["Base"], targetPlayers:[2]

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("defeats a unit the 2 damage is lethal to", async () => {
    const g = new GameTestAdapter();
    const s = setupWith(eventId)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 1) // 3 HP, 1 damage → 2 left
      .Build();
    g.loadNewState(s);
    const targetPlayId = s.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});
