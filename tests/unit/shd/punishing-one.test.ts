import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_137 Punishing One - Dengar's Jumpmaster (3/4 Space, cost 3) —
//   "When an upgraded enemy unit is defeated: You may ready this unit.
//    Use this ability only once each round."
describe("SHD_137 Punishing One - Dengar's Jumpmaster", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Villainy/Aggression-friendly — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  /** An upgraded enemy ground unit that Rival's Fall can kill. */
  function withUpgradedEnemy(b: GameStateBuilder) {
    return b
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        { cardId: Cards.upgrades.sor.jediLightsaber, playId: "@", owner: 2, controller: 2 },
      ]);
  }

  it("may ready itself when an upgraded enemy unit is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      withUpgradedEnemy(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.shd.punishingOne, false) // exhausted
          .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall),
      ).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.spaceArena[0].ready).toBe(true);
  });

  it("declining leaves it exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      withUpgradedEnemy(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.shd.punishingOne, false)
          .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall),
      ).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.spaceArena[0].ready).toBe(false);
  });

  it("does NOT trigger when the defeated enemy unit had no upgrades", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithSpaceUnitForPlayer(1, Cards.units.shd.punishingOne, false)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // no upgrades
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.spaceArena[0].ready).toBe(false);
  });

  it("does NOT trigger when an upgraded FRIENDLY unit is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithSpaceUnitForPlayer(1, Cards.units.shd.punishingOne, false)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.sor.jediLightsaber, playId: "@", owner: 1, controller: 1 },
        ])
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // kill my own upgraded Marine

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.spaceArena[0].ready).toBe(false);
  });

  it("only fires once each round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithSpaceUnitForPlayer(1, Cards.units.shd.punishingOne, false)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.sor.jediLightsaber, playId: "@", owner: 2, controller: 2 },
        ])
        .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)
        .WithUpgradesOnGroundUnitForPlayer(2, 1, [
          { cardId: Cards.upgrades.sor.electrostaff, playId: "@", owner: 2, controller: 2 },
        ])
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    expect(g.state.player1.spaceArena[0].ready).toBe(true);

    // Exhaust it again, then defeat the second upgraded enemy — no second prompt this round.
    g.state.player1.spaceArena[0].ready = false;
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.spaceArena[0].ready).toBe(false);
  });
});
