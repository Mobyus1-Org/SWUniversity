import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { executeRegroupDraw } from "@/server/engine/actions/regroup";
import { Cards } from "../../card-helpers";

// ASH_200 Rehabilitation (Event, cost 5)
// "Choose a non-leader unit. Give that unit –3/–0 for this phase, then take control of it.
//  At the start of the regroup phase, its owner takes control of it."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_200 Rehabilitation", () => {
  it("takes control of an enemy unit and gives it –3/–0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.rehabilitation)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1);
    const stolen = g.state.player1.groundArena[0];
    expect(stolen.cardId).toBe(Cards.units.sor.consularSecurityForce);
    expect(stolen.owner).toBe(2);
    expect(Unit.FromInterface(stolen).CurrentPower()).toBe(0); // 3 – 3, floored at 0
  });

  it("gives the unit back to its owner at the start of the regroup phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.rehabilitation)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player1.groundArena).toHaveLength(1);

    executeRegroupDraw(g.state, []);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("cannot target a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.rehabilitation)
        .TheirLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithGroundUnitForPlayer(2, Cards.units.ash.ahsokaTano)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([
      g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.consularSecurityForce)!.playId,
    ]);
  });

  it("can be aimed at a friendly unit (only the –3/–0 matters then)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.rehabilitation)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(0);
  });

  it("does nothing when there is no non-leader unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.rehabilitation)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
