import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_032 Rancor Keeper (2/4 Ground) —
//   "When a friendly unit is dealt damage and survives: Deal 1 damage to any number of bases.
//    Use this ability only once each round."
describe("ASH_032 Rancor Keeper", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
  }

  it("triggers when a friendly unit takes combat damage and survives, dealing 1 to each chosen base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.rancorKeeper)
        // 4/6 survives 3 combat damage from the attacker below.
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 power attacker
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 1); // attack the Vigilant Honor Guards — it survives

    // Rancor Keeper's reaction should be pending: choose bases to hit.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base", "player2.base"] });

    expect(g.state.player1.base.damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("may choose zero bases (deals no damage)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.rancorKeeper)
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("does not trigger when the damaged friendly unit is defeated (does not survive)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.rancorKeeper)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid) // 1 HP — dies to the attacker
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 1); // attack the Battle Droid — it dies

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("only fires once per round even if multiple friendly units are damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.rancorKeeper)
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards) // survives hit #1
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa) // survives hit #2 (5/8)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true)
        .WithActivePlayer(2)
        .Build(),
    );

    // First attack: Rancor Keeper's reaction fires and is used up.
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 1); // Vigilant Honor Guards survives
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });
    expect(g.state.player2.base.damage).toBe(1);

    // Second attack this round: another friendly unit is damaged and survives, but the
    // once-per-round ability is already spent — no new prompt.
    // (The first Marine died to 4-power counter-damage, so the second Marine is now at index 0.)
    await g.attackWithGroundUnitAsync(2, 0);
    const resultAdapter = await g.chooseGroundUnitAsync(1, 2); // Wampa survives

    expect(resultAdapter.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(1); // unchanged from the second attack
  });
});
