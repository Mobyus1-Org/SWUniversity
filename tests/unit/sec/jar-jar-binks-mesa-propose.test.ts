import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasPlot } from "@/server/engine/card-db/keyword-dictionaries.ts/plot";

// SEC_111 Jar Jar Binks — Mesa Propose… (2/1 Ground, cost 2, Command) —
//   "When Played: You may give another friendly unit +2/+2 for this phase."
//   "Plot"
//
// "Another friendly unit" — never Jar Jar himself, never an enemy. The When Played also runs when he
// is played from resources through Plot.

const JARJAR = Cards.units.sec.jarJarBinksMesaPropose;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

const stats = (u: Parameters<typeof Unit.FromInterface>[0]) => {
  const unit = Unit.FromInterface(u);
  return [unit.CurrentPower(), unit.TotalHP()];
};

describe("SEC_111 Jar Jar Binks — Mesa Propose…", () => {
  it("has Plot", () => {
    expect(HasPlot(JARJAR)).toBe(true);
  });

  it("When Played: gives another friendly unit +2/+2 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().FillResourcesForPlayer(1, MARINE, 14).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, JARJAR).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(stats(g.state.player1.groundArena[0])).toEqual([5, 5]);
    const buff = g.state.currentEffects.filter(e => e.targetPlayId === g.state.player1.groundArena[0].playId);
    expect(buff.map(e => e.duration)).toEqual(["Phase"]);
  });

  it("may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().FillResourcesForPlayer(1, MARINE, 14).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, JARJAR).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(stats(g.state.player1.groundArena[0])).toEqual([3, 3]);
  });

  it("offers only OTHER FRIENDLY units — no prompt with only an enemy unit around", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().FillResourcesForPlayer(1, MARINE, 14).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, JARJAR).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(stats(g.state.player2.groundArena[0])).toEqual([3, 3]);
  });

  it("played via Plot, the When Played still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .FillResourcesForPlayer(1, MARINE, 10)
        .FillResourcesForPlayer(1, JARJAR, 1) // resource index 10
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.deployLeaderAsync(1);
    await g.choosePlotCardAsync(1, 10);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena.some(u => u.cardId === JARJAR)).toBe(true);
    expect(stats(g.state.player1.groundArena[0])).toEqual([5, 5]);
  });
});
