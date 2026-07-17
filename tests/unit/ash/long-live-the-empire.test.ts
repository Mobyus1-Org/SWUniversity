import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_103 Long Live the Empire (Event, Command+Villainy, Imperial trait, cost 2)
// "Defeat a friendly Imperial unit. If you do, resource the top card of your deck."

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.ash.longLiveTheEmpire);
}

describe("ASH_103 Long Live the Empire", () => {
  it("defeats a friendly Imperial unit and resources the top card of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.ash.rukh) // Imperial trait
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );
    const resourcesBefore = g.state.player1.resources.length;
    const deckBefore = g.state.player1.deck.length;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    // Paying the event's cost exhausts resources but doesn't remove them; resourcing the top
    // of the deck adds one new resource card.
    expect(g.state.player1.resources.length).toBe(resourcesBefore + 1);
    expect(g.state.player1.deck.length).toBe(deckBefore - 1);
  });

  it("no eligible friendly Imperial unit: resolves as a no-op, no error, no resourcing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.ash.antDroid) // no Imperial trait
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );
    const resourcesBefore = g.state.player1.resources.length;
    const deckBefore = g.state.player1.deck.length;

    const res = await g.playCardFromHandAsync(1, 0);

    expect(res.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(1); // untouched
    expect(g.state.player1.resources.length).toBe(resourcesBefore); // no resourcing happened
    expect(g.state.player1.deck.length).toBe(deckBefore);
  });

  it("no friendly units at all: resolves as a no-op, no error", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().Build());

    const res = await g.playCardFromHandAsync(1, 0);

    expect(res.lastDispatchResponse?.invalidAction).toBeFalsy();
  });

  it("a friendly non-Imperial unit is not a legal target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.ash.antDroid) // no Imperial trait
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const antDroidPlayId = g.state.player1.groundArena[0].playId;
    const res = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [antDroidPlayId] });

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.groundArena).toHaveLength(1); // survives — was never a legal target
  });

  it("an enemy Imperial unit is not a legal target ('friendly' only)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(2, Cards.units.ash.rukh) // enemy Imperial unit
        .Build(),
    );

    const res = await g.playCardFromHandAsync(1, 0);

    // No eligible friendly target exists (only an enemy Imperial unit) — event resolves as no-op.
    expect(res.lastDispatchResponse?.invalidAction).toBeFalsy();
    expect(g.state.player2.groundArena).toHaveLength(1); // enemy unit untouched
  });
});
