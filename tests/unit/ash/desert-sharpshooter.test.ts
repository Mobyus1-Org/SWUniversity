import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardInPlay } from "@/lib/engine/core-models";

// ASH_170 Desert Sharpshooter (Ground, cost 3) —
// "When Played: You may deal 2 damage to an upgraded ground unit."

function upg(cardId: string): CardInPlay {
  return { cardId, playId: "@", owner: 2, controller: 2 };
}

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_170 Desert Sharpshooter — When Played", () => {
  it("may deal 2 damage to an upgraded ground unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.desertSharpshooter)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [upg(Cards.upgrades.token.experience)])
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId)!;
    expect(target.damage).toBe(2);
  });

  it("cannot target an un-upgraded ground unit (control)", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.desertSharpshooter)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // no upgrade
      .Build();
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined(); // no eligible target, no-op
  });

  it("cannot target an upgraded SPACE unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.desertSharpshooter)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [upg(Cards.upgrades.token.shield)])
      .Build();
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
