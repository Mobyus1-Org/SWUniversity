import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { ADVANTAGE_TOKEN } from "@/server/engine/token-helpers";
import { Cards } from "../../card-helpers";

// ASH_238 Attendant Navigator (2/3 Ground, cost 2)
// "When Played: You may give 2 Advantage tokens to a space unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_238 Attendant Navigator", () => {
  it("gives 2 Advantage tokens to a chosen space unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.attendantNavigator)
        .WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena[0].upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(2);
  });

  it("may decline — no tokens are given", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.attendantNavigator)
        .WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.spaceArena[0].upgrades).toHaveLength(0);
  });

  it("can target an ENEMY space unit (the ability says 'a space unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.attendantNavigator)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(2);
  });

  it("does not prompt at all when there is no space unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.attendantNavigator)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.ash.attendantNavigator)).toBe(true);
  });
});
