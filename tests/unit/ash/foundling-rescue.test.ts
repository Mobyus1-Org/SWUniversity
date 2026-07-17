import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_092 Foundling Rescue (Event, cost 4) —
// "You may defeat a unit with 2 or less remaining HP.\nCreate a Mandalorian token."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.ash.foundlingRescue);
}

function mandalorianCount(g: GameTestAdapter, player: 1 | 2): number {
  const pState = player === 1 ? g.state.player1 : g.state.player2;
  return pState.groundArena.filter(u => u.cardId === "ASH_T01").length;
}

describe("ASH_092 Foundling Rescue", () => {
  it("defeats a chosen unit with 2 or less remaining HP and creates a Mandalorian token", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player2.groundArena[0].playId;
    // Reduce remaining HP to 1 (<=2 threshold).
    g.state.player2.groundArena[0].damage = 2;

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === Cards.events.ash.foundlingRescue);
    await g.playCardFromHandAsync(1, handIdx);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(g.state.player2.groundArena.some(u => u.playId === marinePlayId)).toBe(false);
    expect(mandalorianCount(g, 1)).toBe(1);
  });

  it("declines the defeat and still creates a Mandalorian token", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const marinePlayId = state.player2.groundArena[0].playId;
    g.state.player2.groundArena[0].damage = 2;

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === Cards.events.ash.foundlingRescue);
    await g.playCardFromHandAsync(1, handIdx);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena.some(u => u.playId === marinePlayId)).toBe(true);
    expect(mandalorianCount(g, 1)).toBe(1);
  });

  it("still creates a Mandalorian token when no unit is eligible (no offer made)", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // full HP, not eligible
      .Build();
    g.loadNewState(state);

    const handIdx = g.state.player1.hand.findIndex(c => c.cardId === Cards.events.ash.foundlingRescue);
    const played = await g.playCardFromHandAsync(1, handIdx);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(mandalorianCount(g, 1)).toBe(1);
  });
});
