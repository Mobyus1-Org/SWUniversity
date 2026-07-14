import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_163 Outer Rim Constable (3/1 Ground, Fringe/Official, cost 2)
// "When Played: You may defeat an upgrade."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
    .WithCardInHandForPlayer(1, Cards.units.sec.outerRimConstable);
}

describe("SEC_163 Outer Rim Constable", () => {
  it("When Played: defeats a chosen enemy upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.token.experience, playId: "@", owner: 2, controller: 2 },
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0, 0);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("declining the optional trigger leaves the upgrade alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.token.experience, playId: "@", owner: 2, controller: 2 },
        ])
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
  });

  it("can defeat a FRIENDLY upgrade ('an upgrade', either side)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.token.experience, playId: "@", owner: 1, controller: 1 },
        ])
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 0, 0);

    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
  });

  it("no prompt when there is no upgrade in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());

    const played = await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sec.outerRimConstable)).toBe(true);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
