import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_179 Koiogran Turn (Event, cost 3, Aggression)
//   "Ready a Fighter or Transport unit with 6 or less power."

const AWING = Cards.units.jtl.phoenixSquadronAWing; // 3/2 Space Fighter
const SHUTTLE = Cards.units.jtl.landingShuttle;     // 2/4 Space Transport
const MARINE = Cards.units.sor.battlefieldMarine;   // Ground, neither
const XP = Cards.upgrades.token.experience;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.koiogranTurn);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_179 Koiogran Turn", () => {
  it("readies an exhausted Fighter", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, AWING, false).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena[0].ready).toBe(true);
  });

  it("readies an exhausted Transport", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, SHUTTLE, false).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena[0].ready).toBe(true);
  });

  it("offers Fighters/Transports with 6 or less power on either side — not other units, not 7+ power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithSpaceUnitForPlayer(1, AWING, false)                    // 3 power — eligible
      .WithSpaceUnitForPlayer(1, AWING, false)                    // 3 + 4 XP = 7 — too strong
      .WithUpgradesOnSpaceUnitForPlayer(1, 1, [
        GameStateBuilder.Upgrade(XP, 1), GameStateBuilder.Upgrade(XP, 1),
        GameStateBuilder.Upgrade(XP, 1), GameStateBuilder.Upgrade(XP, 1),
      ])
      .WithSpaceUnitForPlayer(1, AWING, false)                    // 3 + 3 XP = 6 — exactly 6
      .WithUpgradesOnSpaceUnitForPlayer(1, 2, [
        GameStateBuilder.Upgrade(XP, 1), GameStateBuilder.Upgrade(XP, 1), GameStateBuilder.Upgrade(XP, 1),
      ])
      .WithGroundUnitForPlayer(1, MARINE, false)                  // not a Fighter/Transport
      .WithSpaceUnitForPlayer(2, SHUTTLE, false)                  // enemy Transport — eligible
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect([...offer(g)].sort()).toEqual([
      g.state.player1.spaceArena[0].playId,
      g.state.player1.spaceArena[2].playId,
      g.state.player2.spaceArena[0].playId,
    ].sort());
  });

  it("no eligible unit: nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, false).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
