import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_048 Chio Fain (2/4 Ground) — "On Attack: You may choose 2 players. If you do, they each draw a card."
function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
    .WithGroundUnitForPlayer(1, Cards.units.law.chioFain);
}

describe("LAW_048 Chio Fain", () => {
  it("On Attack: both players each draw a card when accepted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const p1Before = g.state.player1.hand.length;
    const p2Before = g.state.player2.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(p1Before + 1);
    expect(g.state.player2.hand.length).toBe(p2Before + 1);
  });

  it("declining draws nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const p1Before = g.state.player1.hand.length;
    const p2Before = g.state.player2.hand.length;

    const res = await g.attackWithGroundUnitAsync(1, 0).then(() => g.chooseBaseAsync(1, 2));
    expect(res.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.length).toBe(p1Before);
    expect(g.state.player2.hand.length).toBe(p2Before);
  });
});
