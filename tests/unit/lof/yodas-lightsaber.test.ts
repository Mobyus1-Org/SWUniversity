import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LOF_102 Yoda's Lightsaber (Upgrade, cost 2, +3/+1) —
//   "Attach to a non-Vehicle unit.
//    When Played: You may use the Force (lose your Force token). If you do, heal 3 damage from a base."
describe("LOF_102 Yoda's Lightsaber", () => {
  function base(myDamage = 0, theirDamage = 0) {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, myDamage)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP, theirDamage)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gives the attached unit +3/+1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.lof.yodasLightsaber, playId: "@", owner: 1, controller: 1 },
        ])
        .Build(),
    );

    const host = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(host.CurrentPower()).toBe(6); // 3 + 3
    expect(host.TotalHP()).toBe(4);      // 3 + 1
  });

  it("When Played: uses the Force to heal 3 from the chosen base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(5)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.lof.yodasLightsaber)
        .Build(),
    );
    g.state.player1.supplemental.forceToken = true;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // attach
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 1);       // heal my own base

    expect(g.state.player1.base.damage).toBe(2); // 5 - 3
  });

  it("can heal the OPPONENT's base ('a base', not 'your base')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(0, 5)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.lof.yodasLightsaber)
        .Build(),
    );
    g.state.player1.supplemental.forceToken = true;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("declining keeps the Force token and heals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(5)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.lof.yodasLightsaber)
        .Build(),
    );
    g.state.player1.supplemental.forceToken = true;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("control: no prompt at all without a Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(5)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.lof.yodasLightsaber)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("cannot attach to a Vehicle unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker) // Vehicle
        .WithCardInHandForPlayer(1, Cards.upgrades.lof.yodasLightsaber)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena[0].upgrades.length).toBe(0);
  });
});
