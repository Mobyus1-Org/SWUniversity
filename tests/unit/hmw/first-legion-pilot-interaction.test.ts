import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { PilotlessFighterOrTransportPlayIds } from "@/server/engine/card-db/upgrade-attach-restrictions";

// Naming "Pilot" with HMW_108 The First Legion takes the Pilot trait off every enemy card — which
// means an enemy Vehicle carrying a Pilot upgrade no longer HAS a Pilot on it. Every "without a
// Pilot on it" restriction then opens up against it.
//
// "Has a Pilot on it" is a question about the Pilot TRAIT, so the count has to be asked of the
// upgrade's holder rather than of its bare card id — otherwise the suppression never reaches it.
const LEGION = Cards.units.hmw.theFirstLegion;
const THIEF = Cards.units.jtl.pantoranStarshipThief;
const FIGHTER = Cards.units.sor.systemPatrolCraft; // 3/4 Space — Vehicle, Fighter
const PILOT = Cards.units.jtl.frisk;               // a Pilot card, placed directly as an upgrade
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithGroundUnitForPlayer(1, LEGION)
    // An enemy Fighter with a Pilot already aboard.
    .WithSpaceUnitForPlayer(2, FIGHTER)
    .WithUpgradesOnSpaceUnitForPlayer(2, 0, [
      { cardId: PILOT, playId: "pilot1", owner: 2, controller: 2 },
    ]);
}

/** The Legion attacks the enemy base and names `trait`. */
async function nameTrait(g: GameTestAdapter, trait: string) {
  const legion = g.state.player1.groundArena.find(u => u.cardId === LEGION)!;
  await g.dispatchAsync(1, "initiate-attack", { playId: legion.playId });
  await g.chooseBaseAsync(1, 2);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [trait] });
}

describe("HMW_108 naming Pilot — an enemy Vehicle stops having a Pilot on it", () => {
  it("the piloted enemy Fighter is normally off limits to 'without a Pilot' effects", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    expect(PilotlessFighterOrTransportPlayIds(g.state)).toHaveLength(0);
  });

  it("after naming Pilot, it counts as pilotless", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await nameTrait(g, "Pilot");

    const fighter = g.state.player2.spaceArena[0];
    expect(PilotlessFighterOrTransportPlayIds(g.state)).toEqual([fighter.playId]);
  });

  it("naming a different trait leaves the Pilot in place", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await nameTrait(g, "Ewok");

    expect(PilotlessFighterOrTransportPlayIds(g.state)).toHaveLength(0);
  });

  it("YOUR own piloted Vehicle still has its Pilot — only enemy cards lose the trait", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithSpaceUnitForPlayer(1, FIGHTER)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        { cardId: PILOT, playId: "pilot2", owner: 1, controller: 1 },
      ])
      .Build());

    await nameTrait(g, "Pilot");

    // Only the enemy's Fighter opens up; the friendly one keeps its Pilot.
    const enemyFighter = g.state.player2.spaceArena[0];
    expect(PilotlessFighterOrTransportPlayIds(g.state)).toEqual([enemyFighter.playId]);
  });

  it("Pantoran Starship Thief can then steal the formerly piloted Fighter", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, THIEF).Build());
    const fighterId = g.state.player2.spaceArena[0].playId;

    await nameTrait(g, "Pilot");
    await g.dispatchAsync(2, "pass-action", {});

    // "You may pay 3 resources. If you do, attach this unit as an upgrade to a Fighter or
    // Transport unit without a Pilot on it. Take control of that unit."
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    expect(
      (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined)?.fromPlayIds,
    ).toContain(fighterId);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [fighterId] });

    // The Fighter is now P1's, wearing the Thief as a Pilot upgrade.
    const stolen = g.state.player1.spaceArena.find(u => u.playId === fighterId);
    expect(stolen).toBeDefined();
    expect(stolen!.upgrades.some(u => u.cardId === THIEF)).toBe(true);
    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("control: without naming Pilot, the Thief has no legal host", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, THIEF).Build());

    await g.playCardFromHandAsync(1, 0);

    // The only Fighter on the board is piloted, so the pay-3 offer never appears.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.spaceArena).toHaveLength(1);
  });
});
