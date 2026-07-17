import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_137 Wipe Them Out (Event, cost 2, Command) — "Attack with a unit. For this attack, you may
// deal its excess damage to another unit in the same arena."

describe("ASH_137 Wipe Them Out", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.ash.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.ash.wipeThemOut);
  }

  it("offers an excess damage redirect when the defender dies with damage to spare", async () => {
    // AT-AT has 9 power. Marine has 3 HP → 6 excess damage.
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.blizzardAssaultAtAt)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // redirect target
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player2.groundArena[0].playId;
    const secondMarinePlayId = state.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // attack with the AT-AT
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [secondMarinePlayId] });

    // Second marine took 6 excess damage (> 3 HP) → defeated
    expect(g.state.player2.groundArena.find(u => u.playId === secondMarinePlayId)).toBeUndefined();
  });

  it("the redirect may be declined, wasting the excess", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.blizzardAssaultAtAt)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player2.groundArena[0].playId;
    const secondMarinePlayId = state.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });
    await g.chooseNoAsync(1);

    const secondMarine = g.state.player2.groundArena.find(u => u.playId === secondMarinePlayId);
    expect(secondMarine?.damage).toBe(0);
  });

  it("no redirect option when the defender's HP meets or exceeds the attacker's power", async () => {
    // AT-AT (9 power) vs 9 HP unit → exactly 0 excess
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.blizzardAssaultAtAt)
      .WithGroundUnitForPlayer(2, Cards.units.sor.blizzardAssaultAtAt)
      .Build();
    g.loadNewState(state);
    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
  });
});
