import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// `roundState.cardsPlayedThisPhase` is the "you played a card this phase" ledger. It was written
// only in completePlayCard's UNIT branch, so events, upgrades and pilots never landed in it — and
// every card asking "if you played a <X> card this phase" silently only ever saw units.
//
// That made LOF_012 Rey ("a NON-UNIT Force card") impossible to satisfy by construction, and made
// TWI_017 Darth Sidious refuse to flip after a Villainy event. `cardsPlayedThisRound` records all
// four kinds and is what this must mirror.

const MARINE = Cards.units.sor.battlefieldMarine;
const VILLAINY_EVENT = "LOF_041";                      // Drain Essence — Vigilance/Villainy
const UPGRADE = Cards.upgrades.sor.academyTraining;    // SOR_120

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

const played = (g: GameTestAdapter) =>
  g.state.roundState.cardsPlayedThisPhase.map(e => e.cardId);

describe("roundState.cardsPlayedThisPhase records every card type", () => {
  it("records a UNIT", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(played(g)).toEqual([MARINE]);
  });

  it("records an EVENT", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInHandForPlayer(1, VILLAINY_EVENT)
        .WithGroundUnitForPlayer(2, MARINE) // Drain Essence needs a damage target
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(played(g)).toEqual([VILLAINY_EVENT]);
  });

  it("records an UPGRADE", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInHandForPlayer(1, UPGRADE)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // attach it

    expect(played(g)).toEqual([UPGRADE]);
  });

  it("stays in step with cardsPlayedThisRound", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInHandForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, UPGRADE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);          // unit
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);          // upgrade
    await g.chooseGroundUnitAsync(1, 0);

    expect(played(g)).toEqual(g.state.roundState.cardsPlayedThisRound.map(e => e.cardId));
  });
});
