import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_100 Poe Dameron — One Hell of a Pilot (3/3 Ground, cost 4; as a Pilot: +2/+3)
// "When played as a unit: Create an X-Wing token. You may attach this unit as an upgrade to a
//  friendly Vehicle unit without a Pilot on it."
// "Piloting [2 resources]"

function xwings(g: GameTestAdapter) {
  return g.state.player1.spaceArena.filter(u => u.cardId === Cards.units.token.xWing);
}

function poeInPlay(g: GameTestAdapter) {
  return g.state.player1.groundArena.some(u => u.cardId === Cards.units.jtl.poeDameron);
}

function setup(withVehicle: boolean) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
    .WithCardInHandForPlayer(1, Cards.units.jtl.poeDameron);
  if (withVehicle) {
    // System Patrol Craft (3/4 Space) is a Vehicle with no Pilot on it.
    b = b.WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft);
  }
  return b.Build();
}

describe("JTL_100 Poe Dameron — When played as a unit", () => {
  it("creates an X-Wing token and may attach himself to a friendly Vehicle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(true));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Unit");
    await g.chooseYesAsync(1); // attach himself as an upgrade
    await g.chooseSpaceUnitAsync(1, 0); // the Vehicle he attaches to

    expect(xwings(g)).toHaveLength(1);
    // Poe left the ground arena and is now an upgrade on the craft.
    expect(poeInPlay(g)).toBe(false);
    const craft = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.systemPatrolCraft)!;
    expect(craft.upgrades.some(u => u.cardId === Cards.units.jtl.poeDameron)).toBe(true);
  });

  it("declining the attach leaves Poe in play as a unit, X-Wing still created", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(true));

    const played = await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Unit");
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    await g.chooseNoAsync(1);

    expect(xwings(g)).toHaveLength(1);
    expect(poeInPlay(g)).toBe(true);
  });

  it("creates exactly one X-Wing even with no Vehicle to attach to", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(false));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Unit");

    expect(xwings(g)).toHaveLength(1); // exactly one — not double-created
    expect(poeInPlay(g)).toBe(true);
  });

  it("played as a Pilot instead: no X-Wing, he becomes the upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(true));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    // "When played as a unit" — he wasn't, so no token.
    expect(xwings(g)).toHaveLength(0);
    const craft = g.state.player1.spaceArena[0];
    expect(craft.upgrades.some(u => u.cardId === Cards.units.jtl.poeDameron)).toBe(true);
  });
});
