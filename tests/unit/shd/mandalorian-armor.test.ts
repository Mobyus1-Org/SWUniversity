import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SHD_073 Mandalorian Armor", () => {
  it("gives a Shield token when attached to a Mandalorian unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper) // Mandalorian
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.upgrades.shd.mandalorianArmor)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const unit = g.state.player1.groundArena[0];
    expect(unit.upgrades.some(u => u.cardId === "SHD_073")).toBe(true);
    expect(unit.upgrades.some(u => u.cardId === "SOR_T02")).toBe(true); // Shield
  });

  it("does NOT give a Shield token when attached to a non-Mandalorian unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not Mandalorian
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.upgrades.shd.mandalorianArmor)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const unit = g.state.player1.groundArena[0];
    expect(unit.upgrades.some(u => u.cardId === "SHD_073")).toBe(true);
    expect(unit.upgrades.some(u => u.cardId === "SOR_T02")).toBe(false); // no Shield
  });
});
