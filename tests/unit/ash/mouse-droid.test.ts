import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { playCost } from "@/server/engine/card-playability";
import { Cards } from "../../card-helpers";

// ASH_237 Mouse Droid (1/1 Ground, cost 1)
// "Raid 1 (This unit gets +1/+0 while attacking.)"
// "When Played: The next Imperial unit you play this phase costs 1 resource less."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

/** Player 2 passes so player 1 can take another action in the same phase. */
async function pass2(g: GameTestAdapter) {
  await g.dispatchAsync(2, "pass-action", {});
}

describe("ASH_237 Mouse Droid", () => {
  it("has Raid 1 — 2 power while attacking, 1 otherwise", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.mouseDroid)
        .Build(),
    );

    const droid = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(droid.CurrentPower()).toBe(1);
    expect(droid.CurrentPower(true)).toBe(2);
  });

  it("makes the next Imperial unit cost 1 resource less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)
        .WithCardInHandForPlayer(1, Cards.units.ash.remnantLookouts) // Imperial, Trooper
        .Build(),
    );

    const before = playCost(g.state, 1, Cards.units.ash.remnantLookouts);
    await g.playCardFromHandAsync(1, 0);

    expect(playCost(g.state, 1, Cards.units.ash.remnantLookouts)).toBe(before - 1);
  });

  it("does not discount a NON-Imperial unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)
        .WithCardInHandForPlayer(1, Cards.units.ash.zealousSoldier) // Rebel, Trooper
        .Build(),
    );

    const before = playCost(g.state, 1, Cards.units.ash.zealousSoldier);
    await g.playCardFromHandAsync(1, 0);

    expect(playCost(g.state, 1, Cards.units.ash.zealousSoldier)).toBe(before);
  });

  it("applies to only ONE Imperial unit — the effect is consumed on the next unit played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)
        .WithCardInHandForPlayer(1, Cards.units.ash.remnantLookouts)
        .WithCardInHandForPlayer(1, Cards.units.ash.remnantLookouts)
        .Build(),
    );

    const full = playCost(g.state, 1, Cards.units.ash.remnantLookouts);
    await g.playCardFromHandAsync(1, 0);      // Mouse Droid — arms the discount
    expect(playCost(g.state, 1, Cards.units.ash.remnantLookouts)).toBe(full - 1);

    await pass2(g);
    await g.playCardFromHandAsync(1, 0);      // first Lookouts — spends it
    expect(playCost(g.state, 1, Cards.units.ash.remnantLookouts)).toBe(full);
  });

  it("its own discount does not apply to itself when two Mouse Droids are played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)
        .Build(),
    );

    const full = playCost(g.state, 1, Cards.units.ash.mouseDroid);
    await g.playCardFromHandAsync(1, 0);
    // Mouse Droid is an Imperial Droid, so the second copy IS discounted by the first.
    expect(playCost(g.state, 1, Cards.units.ash.mouseDroid)).toBe(full - 1);
  });
});
