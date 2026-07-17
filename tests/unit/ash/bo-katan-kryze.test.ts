import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_105 Bo-Katan Kryze (2/4/2 Ground) — "While you control another Mandalorian unit,
// this unit gains Raid 2."
describe("ASH_105 Bo-Katan Kryze", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gets +2/+0 while attacking when you control another Mandalorian unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.boKatanKryze)
        .WithGroundUnitForPlayer(1, Cards.units.shd.theMandalorian) // another Mandalorian
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Power 2 + Raid 2 = 4 to the enemy base.
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("does not get Raid when it is the only Mandalorian unit (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.boKatanKryze)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Power 2 only — no Raid bonus.
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("does not count a non-Mandalorian unit as the trigger", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.boKatanKryze)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel, not Mandalorian
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
  });
});
