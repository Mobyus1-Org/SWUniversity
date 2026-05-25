import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SHD_177 Vambrace Flamethrower — On Attack", () => {
  it("prompts and spreads 3 damage when carrier attacks and enemy ground units exist", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.vambraceFlamethrower, 1),
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    const enemy0 = state.player2.groundArena[0].playId;
    const enemy1 = state.player2.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // On-attack trigger fires: "you may deal 3 damage" — choose Yes
    await g.chooseYesAsync(1);

    // Spread: 2 to enemy0, 1 to enemy1
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: enemy0, damage: 2 },
        { playId: enemy1, damage: 1 },
      ],
    });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena[1].damage).toBe(1);
  });

  it("allows skipping the damage (you may)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.vambraceFlamethrower, 1),
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does not fire when no enemy ground units exist", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.vambraceFlamethrower, 1),
      ])
      // No enemy ground units
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // No prompt — attack resolves directly
    expect(g.state.player2.base.damage).toBeGreaterThan(0);
  });
});
