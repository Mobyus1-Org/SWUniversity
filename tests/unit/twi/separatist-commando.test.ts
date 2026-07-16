import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_180 Separatist Commando (2/3 Ground) — "While you control another Separatist unit,
// this unit gains Raid 2. (It gets +2/+0 while attacking.)"
describe("TWI_180 Separatist Commando", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gets +2/+0 while attacking when you control another Separatist unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.separatistCommando)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid) // another Separatist
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Power 2 + Raid 2 = 4 to the enemy base.
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("does not get Raid when it is the only Separatist unit (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.separatistCommando)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Power 2 only — no Raid bonus.
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("does not count a non-Separatist unit as the trigger", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.twi.separatistCommando)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel, not Separatist
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
  });
});
