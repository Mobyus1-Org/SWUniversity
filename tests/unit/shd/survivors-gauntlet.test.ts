import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_064 Survivors' Gauntlet (4/6 Space, cost 5) —
//   "When Played/On Attack: You may attach an upgrade on a unit to another eligible unit
//    controlled by the same player."
describe("SHD_064 Survivors' Gauntlet", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const saber = (owner: 1 | 2) => ({
    cardId: Cards.upgrades.sor.jediLightsaber, playId: "@", owner, controller: owner,
  });

  it("When Played: moves an upgrade between two units the same player controls", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [saber(1)])
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithCardInHandForPlayer(1, Cards.units.shd.survivorsGauntlet)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 0); // the saber on the Marine
    await g.chooseGroundUnitAsync(1, 1);             // move it to Echo Base Defender

    expect(g.state.player1.groundArena[0].upgrades.length).toBe(0);
    expect(g.state.player1.groundArena[1].upgrades.some(u => u.cardId === Cards.upgrades.sor.jediLightsaber)).toBe(true);
  });

  it("declining leaves the upgrade where it was", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [saber(1)])
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithCardInHandForPlayer(1, Cards.units.shd.survivorsGauntlet)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].upgrades.length).toBe(1);
    expect(g.state.player1.groundArena[1].upgrades.length).toBe(0);
  });

  it("moves an ENEMY's upgrade between the ENEMY's units, without changing control", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [saber(2)])
        .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)
        .WithCardInHandForPlayer(1, Cards.units.shd.survivorsGauntlet)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);
    await g.chooseGroundUnitAsync(2, 1);

    expect(g.state.player2.groundArena[0].upgrades.length).toBe(0);
    const moved = g.state.player2.groundArena[1].upgrades.find(u => u.cardId === Cards.upgrades.sor.jediLightsaber)!;
    expect(moved).toBeTruthy();
    // "controlled by the same player" — this is a move, not a take-control.
    expect(moved.controller).toBe(2);
  });

  it("cannot move an upgrade ACROSS players", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [saber(2)])
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender) // MY unit
        .WithCardInHandForPlayer(1, Cards.units.shd.survivorsGauntlet)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);
    await g.chooseGroundUnitAsync(1, 0); // try to pull it onto my Echo Base Defender

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena[0].upgrades.length).toBe(1);
  });

  it("no prompt when the upgrade's controller has no other eligible unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [saber(1)]) // the only unit that could hold it
        .WithCardInHandForPlayer(1, Cards.units.shd.survivorsGauntlet)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[0].upgrades.length).toBe(1);
  });

  it("respects the upgrade's own attach restriction", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [saber(1)]) // "attach to a non-Vehicle unit"
        .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker) // Vehicle — ineligible
        .WithCardInHandForPlayer(1, Cards.units.shd.survivorsGauntlet)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // The Walker is the only other friendly unit and can't take a Lightsaber → nothing to do.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[0].upgrades.length).toBe(1);
  });

  it("On Attack: offers the same move", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.shd.survivorsGauntlet)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [saber(1)])
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 1, 0);
    await g.chooseGroundUnitAsync(1, 1);

    expect(g.state.player1.groundArena[1].upgrades.some(u => u.cardId === Cards.upgrades.sor.jediLightsaber)).toBe(true);
    expect(g.state.player2.base.damage).toBe(4); // the attack still resolved
  });
});
