import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

// JTL_150 Biggs Darklighter - They'll Never Stop Us (3/4 Ground, cost 3; +2/+1 as an upgrade) —
//   "Piloting [1 resource Aggression Heroism]
//    If attached unit is a Fighter, it gains Overwhelm.
//    If attached unit is a Transport, it gets +0/+1.
//    If attached unit is a Speeder, it gains Grit."
describe("JTL_150 Biggs Darklighter - They'll Never Stop Us", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.sabineWren) // Aggression/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithActivePlayer(1);
  }

  const biggs = { cardId: Cards.units.jtl.biggsDarklighter, playId: "@", owner: 1 as const, controller: 1 as const };

  it("Transport host: gets +0/+1 on top of his printed +2/+1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.shd.theMarauder) // Vehicle/Transport, 4/5
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [biggs])
        .Build(),
    );

    const host = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(host.CurrentPower()).toBe(6); // 4 + 2 (upgrade power)
    expect(host.TotalHP()).toBe(7);      // 5 + 1 (upgrade hp) + 1 (Transport clause)
  });

  it("control: a NON-Transport host gets only the printed +2/+1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter) // Fighter, not Transport — 2/1
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [biggs])
        .Build(),
    );

    const host = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(host.CurrentPower()).toBe(4); // 2 + 2
    expect(host.TotalHP()).toBe(2);      // 1 + 1, no Transport bonus
  });

  it("Fighter host: gains Overwhelm", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [biggs])
        .Build(),
    );

    const host = g.state.player1.spaceArena[0];
    expect(HasKeyword(host.cardId, "Overwhelm", host.playId, 1)).toBe(true);
  });

  it("control: a non-Fighter host does not gain Overwhelm", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker) // Vehicle/Walker
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [biggs])
        .Build(),
    );

    const host = g.state.player1.groundArena[0];
    expect(HasKeyword(host.cardId, "Overwhelm", host.playId, 1)).toBe(false);
  });

  it("Speeder host: gains Grit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.snowspeeder) // Vehicle/Speeder
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [biggs])
        .Build(),
    );

    const host = g.state.player1.groundArena[0];
    expect(HasKeyword(host.cardId, "Grit", host.playId, 1)).toBe(true);
  });

  it("can be played as a Pilot upgrade for 1 resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .WithCardInHandForPlayer(1, Cards.units.jtl.biggsDarklighter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    expect(g.state.player1.spaceArena[0].upgrades.some(u => u.cardId === Cards.units.jtl.biggsDarklighter)).toBe(true);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1);
  });
});
