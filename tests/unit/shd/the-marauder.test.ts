import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// SHD_102 The Marauder - Shuttling the Bad Batch (4/5 Space, cost 5) —
//   "Ambush
//    When Played: Choose a card in your discard pile. Put it into play as a resource if it
//    shares a name with a unit you control."
describe("SHD_102 The Marauder - Shuttling the Bad Batch", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("resources the chosen card when it shares a name with a unit you control", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // the name match
        .WithCardInDiscardForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.theMarauder)
        .Build(),
    );

    const resourcesBefore = g.state.player1.resources.length;
    await g.playCardFromHandAsync(1, 0);
    // Ambush and When Played arrive together — resolve When Played first.
    await g.chooseOptionAsync(1, "The Marauder — When Played");
    const discardId = g.state.player1.discard.find(d => d.cardId === Cards.units.sor.battlefieldMarine)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId] });

    expect(g.state.player1.resources.length).toBe(resourcesBefore + 1);
    expect(g.state.player1.discard.some(d => d.playId === discardId)).toBe(false);
  });

  it("does nothing when the chosen card shares no name with a unit you control", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender) // different name
        .WithCardInDiscardForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.theMarauder)
        .Build(),
    );

    const resourcesBefore = g.state.player1.resources.length;
    await g.playCardFromHandAsync(1, 0);
    // Ambush and When Played arrive together — resolve When Played first.
    await g.chooseOptionAsync(1, "The Marauder — When Played");
    const discardId = g.state.player1.discard.find(d => d.cardId === Cards.units.sor.battlefieldMarine)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId] });

    expect(g.state.player1.resources.length).toBe(resourcesBefore);
    expect(g.state.player1.discard.some(d => d.playId === discardId)).toBe(true);
  });

  it("an ENEMY unit with the matching name does not qualify ('a unit YOU control')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInDiscardForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.theMarauder)
        .Build(),
    );

    const resourcesBefore = g.state.player1.resources.length;
    await g.playCardFromHandAsync(1, 0);
    // Ambush and When Played arrive together — resolve When Played first.
    await g.chooseOptionAsync(1, "The Marauder — When Played");
    const discardId = g.state.player1.discard.find(d => d.cardId === Cards.units.sor.battlefieldMarine)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardId] });

    expect(g.state.player1.resources.length).toBe(resourcesBefore);
  });

  it("control: no prompt with an empty discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.theMarauder)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("Ambush: it may attack immediately when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter) // 2/1
        .WithCardInHandForPlayer(1, Cards.units.shd.theMarauder)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);          // Ambush
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena.length).toBe(0); // 4 power vs a 2/1
  });
});
