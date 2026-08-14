import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_180 Let's Call It War (Event, cost 3) —
// "Deal 3 damage to a unit. Then, if you have the initiative, you may deal 2 damage to another
//  unit in the same arena."
function setup(initiativePlayer: 1 | 2) {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithInitiativePlayerBeing(initiativePlayer)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.sec.letsCallItWar)
      // Two ground units (same arena) and one space unit (different arena).
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .Build(),
  );
  return g;
}

describe("SEC_180 Let's Call It War", () => {
  it("deals 3 damage to the first chosen unit", async () => {
    const g = setup(1);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("with initiative, may deal 2 more to another unit in the same arena", async () => {
    const g = setup(1);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 1);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena[1].damage).toBe(2);
  });

  it("declining the follow-up leaves the second unit undamaged", async () => {
    const g = setup(1);
    await g.playCardFromHandAsync(1, 0);
    const first = await g.chooseGroundUnitAsync(2, 0);
    // Dispatching an option with no pending is a silent no-op, so prove the prompt exists.
    expect(first.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    const res = await g.chooseNoAsync(1);

    expect(res.state.player2.groundArena[0].damage).toBe(3);
    expect(res.state.player2.groundArena[1].damage).toBe(0);
  });

  // "another unit in the same arena" — neither the first target nor a unit in the other arena.
  it("offers only other units in the first target's arena", async () => {
    const g = setup(1);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    const res = await g.chooseYesAsync(1);

    const resolution = res.lastDispatchResponse?.resolutionNeeded;
    const offered = resolution?.type === "Target" ? resolution.fromPlayIds ?? [] : [];
    expect(offered).not.toContain(g.state.player2.groundArena[0].playId); // the first target
    expect(offered).not.toContain(g.state.player2.spaceArena[0].playId);  // wrong arena
    expect(offered).toContain(g.state.player2.groundArena[1].playId);
  });

  // "if you have the initiative" — without it there is no follow-up at all.
  it("offers no follow-up without the initiative", async () => {
    const g = setup(2);
    await g.playCardFromHandAsync(1, 0);
    const res = await g.chooseGroundUnitAsync(2, 0);

    expect(res.state.player2.groundArena[0].damage).toBe(3);
    expect(res.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(res.state.player2.groundArena[1].damage).toBe(0);
  });
});
