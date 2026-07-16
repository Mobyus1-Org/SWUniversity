import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_070 At Attin Safety Droid (1/4 Ground) —
//   "If your base would be dealt more than 4 damage, prevent all but 4 of that damage."
describe("ASH_070 At Attin Safety Droid", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
  }

  it("caps combat damage to its controller's base at 4 when it would take more", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.atAttinSafetyDroid)
        .WithGroundUnitForPlayer(2, Cards.units.ash.grandAdmiralThrawn) // 5 power attacker
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1); // attack player 1's base for 5 damage

    expect(g.state.player1.base.damage).toBe(4);
  });

  it("does not affect damage of 4 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.atAttinSafetyDroid)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 power
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player1.base.damage).toBe(3);
  });

  it("only protects its controller's own base, not the opponent's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.ash.atAttinSafetyDroid) // opponent controls it
        .WithGroundUnitForPlayer(1, Cards.units.ash.grandAdmiralThrawn) // 5 power attacker
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // attack player 2's base — protected by their Safety Droid

    expect(g.state.player2.base.damage).toBe(4);
  });

  it("control: without the Safety Droid, a base takes full damage above 4", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.ash.grandAdmiralThrawn)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player1.base.damage).toBe(5); // no protection — full damage
  });
});
