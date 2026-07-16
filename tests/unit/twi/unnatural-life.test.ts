import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";
import { GetGame } from "@/server/engine/core-functions";

// TWI_189 Unnatural Life (Event, cost 3) — "Play a unit that was defeated this phase from your
// discard pile. It costs 2 resources less and enters play ready. At the start of the regroup
// phase, defeat it."
describe("TWI_189 Unnatural Life", () => {
  const DEFEATED_PLAY_ID = "d1";

  function base(withDefeatedThisPhase: boolean) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .WithInitiativePlayerBeing(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      // a couple of deck cards each so the regroup draw doesn't add empty-deck base damage
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.twi.unnaturalLife);
    const state = b.Build();
    // A unit sitting in player 1's discard.
    state.player1.discard.unshift({
      cardId: Cards.units.sor.battlefieldMarine,
      playId: DEFEATED_PLAY_ID,
      owner: 1,
      controller: 1,
      turnDiscarded: 1,
      discardEffect: "",
    });
    if (withDefeatedThisPhase) {
      state.roundState.cardsLeftPlayThisPhase.push({
        fromPlayer: 1,
        cardId: Cards.units.sor.battlefieldMarine,
        playId: DEFEATED_PLAY_ID,
        reason: "defeated",
      });
    }
    return state;
  }

  it("plays the defeated unit from discard, entering ready, at a 2-resource discount", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(true));

    await g.playCardFromHandAsync(1, 0); // pays for the event; prompts to pick from discard
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");

    // Cost of the replay is the unit's playCost minus 2.
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    const expectedReplayCost = Math.max(0, playCost(GetGame()!.currentGameState, 1, Cards.units.sor.battlefieldMarine) - 2);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [DEFEATED_PLAY_ID] });

    // The Marine is now in play, ready, and no longer in the discard pile.
    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine);
    expect(marine).toBeDefined();
    expect(marine?.ready).toBe(true);
    expect(g.state.player1.discard.some(d => d.playId === DEFEATED_PLAY_ID)).toBe(false);

    const readyAfter = g.state.player1.resources.filter(r => r.ready).length;
    expect(readyBefore - readyAfter).toBe(expectedReplayCost);
  });

  it("defeats the replayed unit at the start of the regroup phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(true));

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [DEFEATED_PLAY_ID] });

    const replayedPlayId = g.state.player1.groundArena.find(
      u => u.cardId === Cards.units.sor.battlefieldMarine,
    )!.playId;

    // End the action phase → regroup draw step runs the UntilStartOfRegroup defeat.
    await g.dispatchAsync(g.state.activePlayer, "pass-action", {});
    await g.dispatchAsync(g.state.activePlayer, "pass-action", {});

    // The replayed Marine is gone from the arena and back in the discard.
    expect(g.state.player1.groundArena.some(u => u.playId === replayedPlayId)).toBe(false);
    expect(g.state.player1.discard.some(d => d.playId === replayedPlayId)).toBe(true);
  });

  it("control: a unit not defeated this phase is not eligible (event fizzles)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(false)); // in discard, but not defeated THIS phase

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.discard.some(d => d.playId === DEFEATED_PLAY_ID)).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
  });
});
