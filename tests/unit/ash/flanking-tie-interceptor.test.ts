import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_215 Flanking TIE Interceptor (2/2 Space, cost 2)
// "Support (When you play this unit, you may attack with another unit. It gains this unit's other
//  abilities for this attack.)"

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.units.ash.flankingTieInterceptor);
}

describe("ASH_215 Flanking TIE Interceptor", () => {
  it("Support: sends another friendly unit to attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player1.groundArena[0].ready).toBe(false); // the Marine attacked, so it exhausted
  });

  it("declining Support does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(0);
  });
});
