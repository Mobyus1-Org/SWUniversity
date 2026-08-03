import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// SHD_105 Spark of Hope (Event, cost 2) —
//   "Choose a unit in your discard pile. If it was defeated this phase, put it into play as a resource."
describe("SHD_105 Spark of Hope", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("resources a unit that was defeated this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .WithCardInHandForPlayer(1, Cards.events.shd.sparkOfHope)
        .Build(),
    );

    // Defeat my own Marine this phase, then Spark of Hope it back as a resource.
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});

    const resourcesBefore = g.state.player1.resources.length;
    await g.playCardFromHandAsync(1, 0);
    const marineInDiscard = g.state.player1.discard.find(d => d.cardId === Cards.units.sor.battlefieldMarine)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marineInDiscard.playId] });

    expect(g.state.player1.resources.length).toBe(resourcesBefore + 1);
    expect(g.state.player1.discard.some(d => d.playId === marineInDiscard.playId)).toBe(false);
  });

  it("does nothing for a unit that was NOT defeated this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInDiscardForPlayer(1, Cards.units.sor.battlefieldMarine) // pre-existing discard
        .WithCardInHandForPlayer(1, Cards.events.shd.sparkOfHope)
        .Build(),
    );

    const resourcesBefore = g.state.player1.resources.length;
    await g.playCardFromHandAsync(1, 0);
    const marineInDiscard = g.state.player1.discard.find(d => d.cardId === Cards.units.sor.battlefieldMarine)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marineInDiscard.playId] });

    expect(g.state.player1.resources.length).toBe(resourcesBefore);
    expect(g.state.player1.discard.some(d => d.playId === marineInDiscard.playId)).toBe(true);
  });

  it("only UNITS in the discard are offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInDiscardForPlayer(1, Cards.events.shd.daringRaid) // an Event
        .WithCardInHandForPlayer(1, Cards.events.shd.sparkOfHope)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // No unit in the discard → the event fizzles with no prompt.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("control: no prompt with an empty discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.events.shd.sparkOfHope)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("matches the exact defeated card, not merely a same-named copy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInDiscardForPlayer(1, Cards.units.sor.battlefieldMarine) // NOT defeated this phase
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .WithCardInHandForPlayer(1, Cards.events.shd.sparkOfHope)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // defeat the in-play Marine
    await g.dispatchAsync(2, "pass-action", {});

    // The stale copy is still ineligible even though a same-named unit died this phase.
    const stale = g.state.player1.discard.filter(d => d.cardId === Cards.units.sor.battlefieldMarine);
    expect(stale.length).toBe(2);

    const resourcesBefore = g.state.player1.resources.length;
    await g.playCardFromHandAsync(1, 0);
    // Pick whichever entry is NOT the one that just left play.
    const defeatedPlayIds = new Set(
      g.state.roundState.cardsLeftPlayThisPhase.filter(e => e.reason === "defeated").map(e => e.playId),
    );
    const staleEntry = stale.find(d => !defeatedPlayIds.has(d.playId))!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [staleEntry.playId] });

    expect(g.state.player1.resources.length).toBe(resourcesBefore);
  });
});
