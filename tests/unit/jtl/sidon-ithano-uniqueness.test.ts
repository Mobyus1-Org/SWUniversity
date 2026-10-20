import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Sidon Ithano is unique, and his whole ability is to become an upgrade on a unit the OPPONENT
// controls while staying yours. That is the inverse of a stolen ship: there, their take-control
// moved your Pilot onto their board; here you put it there yourself.
//
// Either way CR 8.29.3a counts it as your copy in play — "the unique copy limit applies to all
// in-play copies of a unique card, regardless of how that card is in-play" — and CR 8.29.5 keeps
// it player-specific, so it is your uniqueness problem and never your opponent's.
const SIDON = Cards.units.jtl.sidonIthano;
const FIGHTER = Cards.units.sor.systemPatrolCraft;
const MARINE = Cards.units.sor.battlefieldMarine;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) =>
  (needs(g) as { fromPlayIds?: string[] } | undefined)?.fromPlayIds ?? [];
const copiesMine = (g: GameTestAdapter) => {
  const all = [
    ...g.state.player1.groundArena, ...g.state.player1.spaceArena,
    ...g.state.player2.groundArena, ...g.state.player2.spaceArena,
  ];
  return [
    ...all.filter(u => u.cardId === SIDON && u.controller === 1).map(u => u.playId),
    ...all.flatMap(u => u.upgrades
      .filter(up => up.cardId === SIDON && (up.controller ?? up.owner) === 1)
      .map(up => up.playId)),
  ];
};

describe("JTL_213 Sidon Ithano and the uniqueness rule", () => {
  it("riding an enemy ship still counts as my copy in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(2, FIGHTER)
      .WithCardInHandForPlayer(1, SIDON)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });

    // He is on THEIR unit, under MY control — one copy, no conflict yet.
    expect(copiesMine(g)).toHaveLength(1);
    expect(needs(g)).toBeUndefined();
  });

  it("a second copy played as a unit prompts, offering the one aboard the enemy ship", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(2, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
        { cardId: SIDON, playId: "sidon-aboard", owner: 1, controller: 1 },
      ])
      .WithCardInHandForPlayer(1, SIDON)
      .Build());

    await g.playCardFromHandAsync(1, 0); // their ship already has a Pilot, so he enters as a unit

    expect(needs(g)?.type).toBe("Target");
    expect(offered(g)).toHaveLength(2);
    expect(offered(g)).toContain("sidon-aboard");
  });

  it("defeating the copy aboard gives the enemy ship its stats back", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(2, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
        { cardId: SIDON, playId: "sidon-aboard", owner: 1, controller: 1 },
      ])
      .WithCardInHandForPlayer(1, SIDON)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["sidon-aboard"] });

    expect(copiesMine(g)).toHaveLength(1);
    expect(g.state.player2.spaceArena[0].upgrades.some(u => u.cardId === SIDON)).toBe(false);
    // He is my card, so he goes to MY discard even though he died on their board.
    expect(g.state.player1.discard.some(d => d.cardId === SIDON)).toBe(true);
    expect(g.state.player2.discard.some(d => d.cardId === SIDON)).toBe(false);
  });

  it("CR 8.29.5: the opponent's own Sidon is not my conflict", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, SIDON)   // THEIR Sidon, standing in their arena
      .WithSpaceUnitForPlayer(2, FIGHTER)
      .WithCardInHandForPlayer(1, SIDON)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });

    // One copy each — nobody has to defeat anything.
    expect(needs(g)).toBeUndefined();
    expect(copiesMine(g)).toHaveLength(1);
    expect(g.state.player2.groundArena.some(u => u.cardId === SIDON)).toBe(true);
  });
});
