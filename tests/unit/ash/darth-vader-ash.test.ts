import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { Cards } from "../../card-helpers";

// ASH_243 Darth Vader (4/6 Ground, cost 5)
// "Shielded"
// "While this unit is ready, he gains Sentinel."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_243 Darth Vader", () => {
  it("enters play with a Shield token (Shielded)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.darthVader)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const vader = g.state.player1.groundArena[0];
    expect(vader.cardId).toBe(Cards.units.ash.darthVader);
    expect(vader.upgrades.filter(u => u.cardId === "SOR_T02")).toHaveLength(1);
  });

  it("has Sentinel while ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.darthVader, true)
        .Build(),
    );

    const vader = g.state.player1.groundArena[0];
    expect(HasSentinel(vader.cardId, vader.playId, 1)).toBe(true);
  });

  it("loses Sentinel while exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.ash.darthVader, false)
        .Build(),
    );

    const vader = g.state.player1.groundArena[0];
    expect(HasSentinel(vader.cardId, vader.playId, 1)).toBe(false);
  });

  it("forces an enemy attacker to target him while ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.ash.darthVader, true)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);

    const vaderPlayId = g.state.player1.groundArena[0].playId;
    expect(g.lastDispatchResponse?.resolutionNeeded).toMatchObject({ type: "Target" });
    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds;
    expect(targets).toEqual([vaderPlayId]); // Sentinel — only Vader can be attacked
  });

  it("does not force targeting while exhausted (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.ash.darthVader, false)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds;
    expect(targets).toHaveLength(2); // both friendly units are attackable
  });
});
