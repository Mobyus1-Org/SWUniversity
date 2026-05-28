import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardArena } from "@/server/engine/card-db/generated";

describe("SOR_134 Ruthless Raider", () => {
  it("When Played: deals 2 damage to enemy base and 2 damage to chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Aggression+Villainy covers both aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(1, Cards.units.sor.ruthlessRaider)
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine) // high HP target
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("When Defeated: deals 2 damage to enemy base and 2 damage to chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.ruthlessRaider)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
        GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
      ])
      .Build();
    g.loadNewState(state);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player2.spaceArena[0].damage).toBe(6);
  });
});
