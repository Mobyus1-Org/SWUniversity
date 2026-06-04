import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_186 No Good to Me Dead (Event, Cunning+Villainy, cost 2)
// Exhaust a unit. That unit can't ready this round (including during the regroup phase).

describe("SOR_186 No Good to Me Dead", () => {
  it("exhausts the chosen unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP) // Cunning+Villainy coverage
      .MyLeader(Cards.leaders.sor.bobaFett)  // Cunning+Villainy
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.noGoodToMeDead)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("targeted unit cannot ready during the regroup phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.noGoodToMeDead)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player2.groundArena[0].playId;

    // P1 plays No Good to Me Dead, targeting the marine
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // Both players pass to trigger regroup
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    // Both players resource (regroup phase)
    await g.dispatchAsync(1, "pass-resource", {});
    await g.dispatchAsync(2, "pass-resource", {});

    // After regroup: marine should NOT be ready (prevented by No Good to Me Dead)
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("unit becomes ready again in the NEXT round after the prevented round ends", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.bobaFett)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.events.sor.noGoodToMeDead)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player2.groundArena[0].playId;

    // P1 plays No Good to Me Dead
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    // Regroup round 1
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(1, "pass-resource", {});
    await g.dispatchAsync(2, "pass-resource", {});

    // Now in round 2 — both players pass to regroup again
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-resource", {});
    await g.dispatchAsync(2, "pass-resource", {});

    // After round 2 regroup: "Round" effect expired — marine should now be ready
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });
});
