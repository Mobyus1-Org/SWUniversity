import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// JTL_079 Out the Airlock — cost 5 Vigilance event. "Give a unit –5/–5 for this phase."

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.jtl.outTheAirlock);
}

describe("JTL_079 Out the Airlock", () => {
  it("gives the chosen enemy unit -5/-5 for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer).Build()); // 4/10

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    const target = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect(target.CurrentPower()).toBe(0); // 4 - 5, floored at 0
    expect(target.TotalHP()).toBe(5); // 10 - 5
  });

  it("defeats a unit whose HP drops to 0 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build()); // 4/4

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.discard.map(d => d.cardId)).toContain(Cards.units.sor.gamorreanGuards);
  });

  it("defeats a damaged unit once the reduced HP is at or below its damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer, true, 5).Build(), // 5 damage on 10 HP
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0); // HP 5, damage 5
  });

  it("can target a friendly unit ('a unit', either side)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(Unit.FromInterface(g.state.player1.spaceArena[0]).TotalHP()).toBe(5);
  });

  it("the debuff is scoped to this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    const playId = g.state.player2.spaceArena[0].playId;
    const mods = g.state.currentEffects.filter(e => e.targetPlayId === playId && e.value === -5);
    expect(mods).toHaveLength(1);
    expect(mods[0].duration).toBe("Phase");
  });

  it("does not prompt when there is no unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("leaves other units untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(Unit.FromInterface(g.state.player2.spaceArena[0]).TotalHP()).toBe(5);
    expect(Unit.FromInterface(g.state.player2.spaceArena[1]).TotalHP()).toBe(10);
  });
});
