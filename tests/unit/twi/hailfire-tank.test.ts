import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_233 Hailfire Tank (cost 8, 7/6 Ground) — "Exploit 2 (While playing this card, defeat up to
// 2 units you control. This card costs 2 resources less for each unit defeated this way.)"
describe("TWI_233 Hailfire Tank", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku) // Villainy — no aspect penalty on Villainy Hailfire Tank
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren);
  }

  it("costs 4 less when 2 units are exploited (2 each) and enters play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        // Only 4 ready resources — 8-cost tank is unaffordable without Exploit.
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
        .WithCardInHandForPlayer(1, Cards.units.twi.hailfireTank)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // Exploit option
    await g.chooseYesAsync(1);
    await g.exploitGroundUnitsAsync(1, [0, 1]); // defeat both battle droids

    // Tank entered play; the two exploited units are gone.
    const ground = g.state.player1.groundArena;
    expect(ground.some(u => u.cardId === Cards.units.twi.hailfireTank)).toBe(true);
    expect(ground.filter(u => u.cardId === Cards.units.token.battleDroid)).toHaveLength(0);
    // 8 - (2*2) = 4 paid; all 4 resources spent.
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(0);
  });

  it("costs 2 less when only 1 unit is exploited", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
        .WithCardInHandForPlayer(1, Cards.units.twi.hailfireTank)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0); // Exploit option
    await g.chooseYesAsync(1);
    await g.exploitGroundUnitsAsync(1, [0]); // defeat one

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.hailfireTank)).toBe(true);
    // 8 - 2 = 6 paid; all 6 resources spent.
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(0);
  });
});
