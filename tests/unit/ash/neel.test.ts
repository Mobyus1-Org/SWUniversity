import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_248 Neel (1/4 Ground, cost 1)
// "When Played/On Attack: The next unit you play this phase with 1 or less power enters play ready."

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

describe("ASH_248 Neel", () => {
  it("When Played: the next 1-power unit enters play ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.neel)
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid) // 1 power
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await pass2(g);
    await g.playCardFromHandAsync(1, 0);

    const droid = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.mouseDroid)!;
    expect(droid.ready).toBe(true);
  });

  it("a 1-power unit played without Neel enters exhausted (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("does not ready a unit with MORE than 1 power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.neel)
        .WithCardInHandForPlayer(1, Cards.units.ash.zealousSoldier) // 2 power
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await pass2(g);
    await g.playCardFromHandAsync(1, 0);

    const soldier = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.zealousSoldier)!;
    expect(soldier.ready).toBe(false);
  });

  it("is not spent by a big unit — it waits for the next 1-power one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.neel)
        .WithCardInHandForPlayer(1, Cards.units.ash.zealousSoldier) // 2 power — does not qualify
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)     // 1 power — should be readied
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await pass2(g);
    await g.playCardFromHandAsync(1, 0);
    await pass2(g);
    await g.playCardFromHandAsync(1, 0);

    const droid = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.mouseDroid)!;
    expect(droid.ready).toBe(true);
  });

  it("readies only ONE unit — a second 1-power unit still enters exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.neel)
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)
        .WithCardInHandForPlayer(1, Cards.units.ash.lepRatcatcher) // also 1 power
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await pass2(g);
    await g.playCardFromHandAsync(1, 0);
    await pass2(g);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // LEP Ratcatcher's optional damage

    expect(g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.mouseDroid)!.ready).toBe(true);
    expect(g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.lepRatcatcher)!.ready).toBe(false);
  });

  it("On Attack: also arms the effect", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.neel)
        .WithCardInHandForPlayer(1, Cards.units.ash.mouseDroid)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await pass2(g);
    await g.playCardFromHandAsync(1, 0);

    const droid = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.mouseDroid)!;
    expect(droid.ready).toBe(true);
  });
});
