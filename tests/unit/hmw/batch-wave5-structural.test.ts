import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Wave 5a — two cards that change a rule rather than just applying an effect.
//
// (Vice Admiral Rampart belongs here too, but base-upgrade defeat has no single chokepoint to
// hang his replacement on — see the batch notes. He is deliberately not implemented yet.)
//
//   HMW_053 Fett's Firespray      6/6  "Friendly units can attack bases while using Ambush."
//   HMW_054 Seismic Detonation  Event 6 "Choose an arena. At the start of the next regroup phase,
//                                       deal 3 damage to each enemy unit in that arena."
const FIRESPRAY = Cards.units.hmw.fettsFirespray;
const SEISMIC = Cards.events.hmw.seismicDetonation;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground
// Syndicate Lackeys: a 5/4 Ground unit whose only printed text is Ambush, and whose Ambush is
// already registered — Clever Trapper's is not, which is a separate gap.
const AMBUSHER = Cards.units.sor.syndicateLackeys;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;

describe("HMW_053 Fett's Firespray", () => {
  it("an ambushing friendly unit may attack a base while it is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIRESPRAY)
      .WithCardInHandForPlayer(1, AMBUSHER)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);

    // The OFFER is what Firespray changes. Asserting only that a dispatched base attack lands
    // would pass regardless, because the base branch of attack-target does not re-validate.
    const offer = needs(g) as { fromZones?: string[]; baseTargetPlayers?: number[] } | undefined;
    expect(offer?.fromZones).toContain("Base");
    expect(offer?.baseTargetPlayers).toEqual([2]); // only the ENEMY base

    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBeGreaterThan(0);
  });

  it("without it, an ambushing unit with no enemy unit simply fizzles", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, AMBUSHER).Build());

    await g.playCardFromHandAsync(1, 0);

    // No enemy unit and no Firespray, so Ambush has nothing to hit and is never offered.
    expect(needs(g)).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("does not help the ENEMY's ambushers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithSpaceUnitForPlayer(1, FIRESPRAY)
      .WithCardInHandForPlayer(2, AMBUSHER)
      .WithActivePlayer(2)
      .Build());

    await g.playCardFromHandAsync(2, 0);

    // P2's ambusher gets no base permission from P1's Firespray, and there is no unit to hit
    // except the Firespray itself, which is in the other arena.
    expect(needs(g)).toBeUndefined();
    expect(g.state.player1.base.damage).toBe(0);
  });
});

describe("HMW_054 Seismic Detonation", () => {
  it("damages each enemy unit in the chosen arena at the start of regroup", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // 3/4 Space — spared
      .WithGroundUnitForPlayer(1, MARINE)                           // friendly — spared
      .WithCardInHandForPlayer(1, SEISMIC)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Ground");

    // Nothing happens yet — it is a delayed effect.
    expect(g.state.player2.groundArena).toHaveLength(2);

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    // Both enemy ground Marines took 3 and died; the space unit and the friendly are untouched.
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
    expect(g.state.player1.groundArena.some(x => x.cardId === MARINE)).toBe(true);
  });

  it("choosing Space hits the space arena instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, MARINE)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // 3/4 — survives on 1 HP
      .WithCardInHandForPlayer(1, SEISMIC)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Space");
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.player2.spaceArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
