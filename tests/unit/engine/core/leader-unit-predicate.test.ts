import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { CardIsLeader, IsLeaderUnit } from "@/server/engine/core-functions";
import { UpgradeEligibleTargets } from "@/server/engine/card-db/upgrade-attach-restrictions";

// Two predicates that read almost the same and answer different questions.
//
//   CardIsLeader(cardId)  — "is this CARD a leader card"
//   IsLeaderUnit(unit)    — "is this unit IN PLAY a leader unit"
//
// They diverge on a Vehicle carrying a leader deployed as a Pilot. The Vehicle is an ordinary unit
// card, but deploying a leader onto it makes it a leader unit:
//
//   CR 3.4.7 — "Some abilities make non-leader units leader units. This means the unit is
//   considered a leader unit for all abilities that refer to 'leader' or 'non-leader' units, but it
//   doesn't follow rules 3.4.1-3.4.6. […] it can change control or move to an out-of-play zone, and
//   when it is defeated, it is placed in the discard pile, not the base zone."
//
// So every "non-leader unit" restriction must ask IsLeaderUnit, while the clauses about where a
// defeated card goes, and an UPGRADE's own identity, still ask CardIsLeader. Reading the card where
// the ability says "unit" silently lets effects like Change of Heart steal a piloted leader.
const VEHICLE = Cards.units.sor.tieLnFighter;            // 2/1 Space, cost 1 — Vehicle, Fighter
const PILOT_LEADER = Cards.leaders.jtl.wedgeAntilles;    // deploys as a Pilot upgrade
const POE = Cards.leaders.jtl.poeDameron;                // attaches himself by his own ability
const TRAITOROUS = Cards.upgrades.sor.traitorous;        // "Attach to a non-leader unit that costs 3 or less"
const CHANGE_OF_HEART = Cards.events.sor.changeOfHeart;  // "Take control of a non-leader unit"
const WAYLAY = Cards.events.twi.waylay;                  // "Return a non-leader unit to its owner's hand"
const JUMP = Cards.events.jtl.jumpToLightspeed;          // "Return a friendly space unit …" — no restriction
const MARINE = Cards.units.sor.battlefieldMarine;

/** P2 holds `VEHICLE` in space; `pilot` (if given) rides it as P2's deployed leader. */
function setup(pilot?: string) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(pilot ?? Cards.leaders.sor.sabineWren, true, pilot !== undefined)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithSpaceUnitForPlayer(2, VEHICLE);
  if (pilot) {
    b = b.WithUpgradesOnSpaceUnitForPlayer(2, 0, [
      { cardId: pilot, playId: "ldr", owner: 2, controller: 2 },
    ]);
  }
  return b;
}
const vehicleOf = (g: GameTestAdapter) => g.state.player2.spaceArena[0];
const offered = (g: GameTestAdapter) => {
  const r = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined;
  return r?.fromPlayIds ?? [];
};

describe("IsLeaderUnit vs CardIsLeader", () => {
  it("a plain unit is neither", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const v = vehicleOf(g);
    expect(CardIsLeader(v.cardId)).toBe(false);
    expect(IsLeaderUnit(v)).toBe(false);
  });

  it("a Vehicle with a leader Pilot is a leader UNIT but not a leader CARD", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(PILOT_LEADER).Build());
    const v = vehicleOf(g);
    expect(CardIsLeader(v.cardId)).toBe(false); // the host is an ordinary unit card…
    expect(IsLeaderUnit(v)).toBe(true);         // …and still a leader unit (CR 3.4.7)
  });

  it("Poe Dameron attaches by his own ability, not a Pilot deploy, so his host stays a non-leader unit", () => {
    // JTL_013's Action attaches him as an upgrade; it is not a deploy-as-Pilot ability, so it does
    // not make the host a leader unit.
    const g = new GameTestAdapter();
    g.loadNewState(setup(POE).Build());
    expect(IsLeaderUnit(vehicleOf(g))).toBe(false);
  });
});

describe("'non-leader unit' restrictions respect a leader Pilot's host", () => {
  it("Traitorous cannot attach to it, but can to the same Vehicle unpiloted", () => {
    const piloted = new GameTestAdapter();
    piloted.loadNewState(setup(PILOT_LEADER).WithCardInHandForPlayer(1, TRAITOROUS).Build());
    expect(UpgradeEligibleTargets(TRAITOROUS, piloted.state, 1))
      .not.toContain(vehicleOf(piloted).playId);

    const bare = new GameTestAdapter();
    bare.loadNewState(setup().WithCardInHandForPlayer(1, TRAITOROUS).Build());
    expect(UpgradeEligibleTargets(TRAITOROUS, bare.state, 1))
      .toContain(vehicleOf(bare).playId);
  });

  it("Change of Heart cannot take control of it, but can of the same Vehicle unpiloted", async () => {
    const piloted = new GameTestAdapter();
    piloted.loadNewState(setup(PILOT_LEADER).WithCardInHandForPlayer(1, CHANGE_OF_HEART).Build());
    await piloted.playCardFromHandAsync(1, 0);
    expect(offered(piloted)).not.toContain(vehicleOf(piloted).playId);
    // The Vehicle is still P2's.
    expect(piloted.state.player2.spaceArena).toHaveLength(1);

    const bare = new GameTestAdapter();
    bare.loadNewState(setup().WithCardInHandForPlayer(1, CHANGE_OF_HEART).Build());
    const bareId = vehicleOf(bare).playId;
    await bare.playCardFromHandAsync(1, 0);
    expect(offered(bare)).toContain(bareId);
    await bare.dispatchAsync(1, "choose-target", { targetPlayIds: [bareId] });
    expect(bare.state.player1.spaceArena.some(u => u.playId === bareId)).toBe(true);
  });

  it("Waylay cannot bounce it, but can the same Vehicle unpiloted", async () => {
    const piloted = new GameTestAdapter();
    piloted.loadNewState(setup(PILOT_LEADER).WithCardInHandForPlayer(1, WAYLAY).Build());
    await piloted.playCardFromHandAsync(1, 0);
    expect(offered(piloted)).not.toContain(vehicleOf(piloted).playId);

    const bare = new GameTestAdapter();
    bare.loadNewState(setup().WithCardInHandForPlayer(1, WAYLAY).Build());
    expect(await bare.playCardFromHandAsync(1, 0) && offered(bare))
      .toContain(vehicleOf(bare).playId);
  });

  it("Poe's host is NOT protected — his attach is not a Pilot deploy", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(POE).WithCardInHandForPlayer(1, TRAITOROUS).Build());
    expect(UpgradeEligibleTargets(TRAITOROUS, g.state, 1)).toContain(vehicleOf(g).playId);
  });
});

describe("abilities that say plain 'unit' are NOT restricted", () => {
  it("Jump to Lightspeed still returns a friendly space unit carrying a leader Pilot", async () => {
    // "Return a friendly space unit and any number of non-leader upgrades on it […]" — the
    // non-leader restriction is on the UPGRADES only, so the host is eligible however it is piloted.
    // This is the case the IsLeaderUnit sweep must not swallow.
    const g = new GameTestAdapter();
    g.loadNewState(new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(PILOT_LEADER, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, MARINE, 20)
      .WithSpaceUnitForPlayer(1, VEHICLE)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        { cardId: PILOT_LEADER, playId: "ldr", owner: 1, controller: 1 },
      ])
      .WithCardInHandForPlayer(1, JUMP)
      .Build());
    const vehicleId = g.state.player1.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);

    expect(offered(g)).toContain(vehicleId);
  });
});
