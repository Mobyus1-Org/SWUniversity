import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_108 Crix Madine — Strike Team Strategist. Cost 3, 3/2 Ground Rebel/Official, unique.
//   "When Played: You may play a Heroism unit from your hand. It costs 2 resources less for each
//    arena in which you control the most units."
//
// "The most units" is a STRICT majority — a tie gives nothing — and both arenas are checked, so
// the reduction is 0, 2 or 4. Crix himself is already in play when it is measured.

const CRIX = Cards.units.ash.crixMadine;              // cost 3, [Command,Heroism]
const HEROISM_UNIT = Cards.units.ash.childrenOfTheWatch; // cost 6, [Command,Heroism] Ground
const NON_HEROISM = Cards.units.sor.wampa;            // cost 4, [Aggression]
const MARINE = Cards.units.sor.battlefieldMarine;     // 3/3 Ground
const XWING = Cards.units.sor.wingLeader;             // Space

/** Command base + Command/Heroism leader, so every fixture card is on-aspect. */
function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, CRIX);
}

const spent = (g: GameTestAdapter) => g.state.player1.resources.filter(r => !r.ready).length;
const inPlay = (g: GameTestAdapter, cardId: string) =>
  [...g.state.player1.groundArena, ...g.state.player1.spaceArena].some(u => u.cardId === cardId);

/** Plays Crix (hand index 0) and accepts his When Played, choosing the card at `handIndex`. */
async function playCrixThenUnit(g: GameTestAdapter, handIndex: number) {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseYesAsync(1);
  await g.chooseCardFromHandAsync(1, handIndex);
}

describe("ASH_108 Crix Madine — Strike Team Strategist", () => {
  it("gives no reduction when neither arena is a majority", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, HEROISM_UNIT)
        .WithGroundUnitForPlayer(2, MARINE) // after Crix lands: ground 1 v 1, space 0 v 0
        .Build(),
    );

    await playCrixThenUnit(g, 0);

    expect(inPlay(g, HEROISM_UNIT)).toBe(true);
    expect(spent(g)).toBe(3 + 6);
  });

  it("reduces by 2 for a majority in ONE arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, HEROISM_UNIT)
        .WithGroundUnitForPlayer(1, MARINE)  // after Crix: ground 2 v 1 → majority
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await playCrixThenUnit(g, 0);

    expect(spent(g)).toBe(3 + 4);
  });

  it("reduces by 4 for a majority in BOTH arenas", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, HEROISM_UNIT)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithSpaceUnitForPlayer(1, XWING)    // space 1 v 0 → majority
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await playCrixThenUnit(g, 0);

    expect(spent(g)).toBe(3 + 2);
  });

  it("counts an EMPTY space arena on both sides as a tie, not a majority", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, HEROISM_UNIT)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await playCrixThenUnit(g, 0);

    // Ground majority only: 0 v 0 in space must NOT count as controlling the most.
    expect(spent(g)).toBe(3 + 4);
  });

  it("is optional — declining leaves the unit in hand and spends nothing extra", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, HEROISM_UNIT).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(inPlay(g, HEROISM_UNIT)).toBe(false);
    expect(g.state.player1.hand.some(c => c.cardId === HEROISM_UNIT)).toBe(true);
    expect(spent(g)).toBe(3);
  });

  it("offers nothing when the hand holds no Heroism unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, NON_HEROISM).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(inPlay(g, CRIX)).toBe(true);
  });

  it("rejects a non-Heroism card even when one is in hand alongside", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, HEROISM_UNIT)
        .WithCardInHandForPlayer(1, NON_HEROISM)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const nonHeroismIdx = g.state.player1.hand.findIndex(c => c.cardId === NON_HEROISM);
    const res = await g.chooseCardFromHandAsync(1, nonHeroismIdx);

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
    expect(inPlay(g, NON_HEROISM)).toBe(false);
  });
});
