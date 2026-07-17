import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_174 StarFortress Heavy Bomber (Space, cost 5) —
// "When Played: You may deal 6 damage to a non-unique ground unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_174 StarFortress Heavy Bomber — When Played", () => {
  it("may deal 6 damage to a non-unique ground unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.starfortressHeavyBomber)
      .WithGroundUnitForPlayer(2, Cards.units.sor.atAtSuppressor) // non-unique, 8 HP — survives
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId)!;
    expect(target.damage).toBe(6);
  });

  it("cannot target a unique ground unit (control)", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.starfortressHeavyBomber)
      .WithGroundUnitForPlayer(2, Cards.units.ash.boKatanKryze) // unique
      .Build();
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined(); // no eligible target
  });

  it("cannot target a space unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.starfortressHeavyBomber)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("may decline — nothing happens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.starfortressHeavyBomber)
      .WithGroundUnitForPlayer(2, Cards.units.sor.atAtSuppressor)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
