import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_167 Flarestar Attack Shuttle (2/1 Space, cost 2) —
// "When Played/When Defeated: You may give an Advantage token to a unit."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_167 Flarestar Attack Shuttle — When Played", () => {
  it("may give an Advantage token to a unit", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithActivePlayer(1)
      .WithCardInHandForPlayer(1, Cards.units.ash.flarestarAttackShuttle)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(1);
  });

  it("may decline — nothing happens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithActivePlayer(1)
      .WithCardInHandForPlayer(1, Cards.units.ash.flarestarAttackShuttle)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
  });
});

describe("ASH_167 Flarestar Attack Shuttle — When Defeated", () => {
  it("may give an Advantage token to a unit after being defeated", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithActivePlayer(2)
      .WithSpaceUnitForPlayer(1, Cards.units.ash.flarestarAttackShuttle) // 2/1 — dies to any hit
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.ash.flarestarAttackShuttle)).toBe(false);

    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId)!;
    expect(marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(1);
  });
});
