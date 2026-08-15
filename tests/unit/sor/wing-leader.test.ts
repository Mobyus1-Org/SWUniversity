import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_241 Wing Leader (2/1 Space, Rebel/Vehicle/Fighter, cost 3)
// "When Played: Give 2 Experience tokens to another friendly Rebel unit."
//
// "Another friendly Rebel unit" — nothing about being ready. An exhausted Rebel (one that has
// already attacked, or entered play exhausted) is just as legal a target.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
    .WithCardInHandForPlayer(1, Cards.units.sor.wingLeader);
}

describe("SOR_241 Wing Leader", () => {
  it("gives 2 Experience tokens to a ready friendly Rebel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const target = g.state.player1.groundArena[0];
    expect(target.upgrades).toHaveLength(2);
    expect(target.upgrades.every(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });

  it("can target an EXHAUSTED friendly Rebel — the ability has no ready requirement", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const target = g.state.player1.groundArena[0];
    expect(target.upgrades).toHaveLength(2);
    expect(target.upgrades.every(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });

  it("offers no target when the only other friendly unit is not a Rebel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper, false).Build());

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
  });
});
