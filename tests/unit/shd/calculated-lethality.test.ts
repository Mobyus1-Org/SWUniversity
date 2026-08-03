import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_039 Calculated Lethality (Event, cost 4) —
//   "Defeat a non-leader unit that costs 3 or less. For each upgrade that was on that unit,
//    give an Experience token to a friendly unit."
describe("SHD_039 Calculated Lethality", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Villainy/Vigilance — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("defeats an unupgraded enemy unit costing 3 or less and gives no Experience", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // a friendly XP recipient exists
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // cost 2, no upgrades
        .WithCardInHandForPlayer(1, Cards.events.shd.calculatedLethality)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    // Zero upgrades were on it → no XP prompt, and the friendly Marine gains nothing.
    expect(g.state.player1.groundArena[0].upgrades.length).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("gives one Experience token per upgrade that was on the defeated unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // cost 2
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.sor.jediLightsaber, playId: "@", owner: 2, controller: 2 },
          { cardId: Cards.upgrades.token.experience, playId: "@", owner: 2, controller: 2 },
        ])
        .WithCardInHandForPlayer(1, Cards.events.shd.calculatedLethality)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);

    // Two upgrades were on it → distribute 2 Experience tokens among friendly units.
    await g.dispatchAsync(1, "choose-target", {
      targetPlayIds: [g.state.player1.groundArena[0].playId, g.state.player1.groundArena[1].playId],
    });

    const xp = (i: number) => g.state.player1.groundArena[i].upgrades
      .filter(u => u.cardId === Cards.upgrades.token.experience).length;
    expect(xp(0)).toBe(1);
    expect(xp(1)).toBe(1);
  });

  it("both Experience tokens may go on the same friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.sor.jediLightsaber, playId: "@", owner: 2, controller: 2 },
          { cardId: Cards.upgrades.sor.electrostaff, playId: "@", owner: 2, controller: 2 },
        ])
        .WithCardInHandForPlayer(1, Cards.events.shd.calculatedLethality)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const only = g.state.player1.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [only, only] });

    expect(g.state.player1.groundArena[0].upgrades
      .filter(u => u.cardId === Cards.upgrades.token.experience).length).toBe(2);
  });

  it("cannot target a unit costing more than 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.vigilantHonorGuards)  // cost 5 — ineligible
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)    // cost 2 — eligible
        .WithCardInHandForPlayer(1, Cards.events.shd.calculatedLethality)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // the cost-5 Honor Guards

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena.length).toBe(2);
  });

  it("can defeat a friendly unit costing 3 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2, friendly
        .WithCardInHandForPlayer(1, Cards.events.shd.calculatedLethality)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena.length).toBe(0);
  });
});
