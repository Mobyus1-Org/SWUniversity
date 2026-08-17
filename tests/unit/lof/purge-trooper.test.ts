import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_133 Purge Trooper (4/2 Ground, Imperial/Trooper, cost 3)
//   "When Played: You may deal 2 damage to a Force unit."
//
// "A Force unit" is either side's, and the trait is what matters — not the aspect.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.lof.purgeTrooper);
}

describe("LOF_133 Purge Trooper", () => {
  it("deals 2 damage to the chosen enemy Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithGroundUnitForPlayer(2, Cards.units.lof.talzinsAssassin).Build(), // Force/Night 4/4
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("declining deals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.lof.talzinsAssassin).Build());

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("can target a FRIENDLY Force unit — 'a Force unit', either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.lof.talzinsAssassin).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
  });

  it("only FORCE units are offered — a non-Force unit is not eligible", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(2, Cards.units.lof.talzinsAssassin)     // Force
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)   // not Force
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const afterYes = await g.chooseYesAsync(1);

    const res = afterYes.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player2.groundArena[1].playId);
  });

  it("no prompt when there is no Force unit in play (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
