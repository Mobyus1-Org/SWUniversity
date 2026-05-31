import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_093 Alliance Dispatcher — 1/2 Ground (Command+Heroism)
// Action [Exhaust]: Play a unit from your hand. It costs [1 resource] less.

describe("SOR_093 Alliance Dispatcher", () => {
  it("plays a unit from hand at -1 cost", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      // Battlefield Marine costs 2; with -1 we need 1 ready resource
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithGroundUnitForPlayer(1, Cards.units.sor.allianceDispatcher)
      .Build();
    g.loadNewState(state);
    state.player1.hand = [{ cardId: Cards.units.sor.battlefieldMarine }];
    const dispatcherPlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.allianceDispatcher, playId: dispatcherPlayId });

    // play-from-hand resolves as a "Target" prompt with fromZones: ["Hand"]
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    // Marine is now in play, dispatcher exhausted, 1 resource spent
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    const dispatcher = g.state.player1.groundArena.find(u => u.playId === dispatcherPlayId);
    expect(dispatcher?.ready).toBe(false);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1);
  });

  it("does not allow playing non-unit cards", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithGroundUnitForPlayer(1, Cards.units.sor.allianceDispatcher)
      .Build();
    g.loadNewState(state);
    state.player1.hand = [{ cardId: Cards.events.sor.strikeTrue }];
    const dispatcherPlayId = state.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.sor.allianceDispatcher, playId: dispatcherPlayId });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
