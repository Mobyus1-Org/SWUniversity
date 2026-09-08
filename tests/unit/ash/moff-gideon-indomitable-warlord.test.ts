import { describe, it, expect } from "vitest";

import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { HasGrit } from "@/server/engine/card-db/keyword-dictionaries.ts/grit";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import { HasSupport } from "@/server/engine/card-db/keyword-dictionaries.ts/support";
import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_008 Moff Gideon — Indomitable Warlord. 5/8 Ground Imperial/Official leader, deploy 7.
//   Leader:   "Action [Exhaust]: If a friendly Imperial unit was defeated this phase, play a unit
//              from your hand. It costs 1 resource less."
//   Deployed: "This unit gains each of the following keywords if it is on an Imperial unit in your
//              discard pile: Ambush, Grit, Hidden, Overwhelm, Saboteur, Sentinel, Shielded,
//              Support."
//
// Only those eight are copied — Raid, Restore and Piloting are not on the list — and only from
// your OWN discard, only from UNITS, and only from ones with the Imperial trait.

const GIDEON = Cards.leaders.ash.moffGideonIndomitableWarlord;
const MARINE = Cards.units.sor.battlefieldMarine;        // 3/3, cost 2
const WAMPA = Cards.units.sor.wampa;                     // 4/5, cost 4 — enemy defender
// Cost 4 and [Villainy] only, so it is on-aspect under a Command base + Command/Villainy
// leader and its cost needs no penalty arithmetic.
const HAND_UNIT = "ASH_242";
const IMPERIAL_TROOPER = Cards.units.ash.remnantOfficial; // Imperial/Official — dies to seed the phase
const NON_IMPERIAL = "SOR_052"; // Redemption — prints Sentinel, but is Rebel, not Imperial

// Imperial units in the discard, each printing the keyword under test.
const D_AMBUSH = "SOR_115";   // Agent Kallus — Ambush
const D_GRIT = "SOR_032";     // Scout Bike Pursuer — Grit
const D_HIDDEN = "ASH_244";
const D_OVERWHELM = "ASH_096";
const D_SABOTEUR = "ASH_141";
const D_SENTINEL = "ASH_048";
const D_SHIELDED = "ASH_193";
const D_SUPPORT = "ASH_033";

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(GIDEON)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

/** Deploys Gideon (needs 7 resources) and returns his in-play playId. */
async function deployGideon(g: GameTestAdapter): Promise<string> {
  await g.deployLeaderAsync(1);
  const unit = g.state.player1.groundArena.find(u => u.cardId === GIDEON);
  if (!unit) throw new Error("Moff Gideon did not deploy");
  return unit.playId;
}

const spent = (g: GameTestAdapter) => g.state.player1.resources.filter(r => !r.ready).length;

describe("ASH_008 Moff Gideon — Indomitable Warlord", () => {
  describe("deployed side: copies keywords from Imperial units in your discard", () => {
    async function withDiscard(discardCardId: string) {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInDiscardForPlayer(1, discardCardId).Build());
      const playId = await deployGideon(g);
      return { g, playId };
    }

    it("copies Ambush", async () => {
      const { playId } = await withDiscard(D_AMBUSH);
      expect(HasAmbush(GIDEON, playId, undefined, 1)).toBe(true);
    });

    it("copies Grit", async () => {
      const { playId } = await withDiscard(D_GRIT);
      expect(HasGrit(GIDEON, playId, 1)).toBe(true);
    });

    it("copies Hidden", async () => {
      const { playId } = await withDiscard(D_HIDDEN);
      expect(HasHidden(GIDEON, playId, 1)).toBe(true);
    });

    it("copies Overwhelm", async () => {
      const { playId } = await withDiscard(D_OVERWHELM);
      expect(HasOverwhelm(GIDEON, playId, 1)).toBe(true);
    });

    it("copies Saboteur", async () => {
      const { playId } = await withDiscard(D_SABOTEUR);
      expect(HasSaboteur(GIDEON, playId, 1)).toBe(true);
    });

    it("copies Sentinel", async () => {
      const { playId } = await withDiscard(D_SENTINEL);
      expect(HasSentinel(GIDEON, playId, 1)).toBe(true);
    });

    it("copies Shielded", async () => {
      const { playId } = await withDiscard(D_SHIELDED);
      expect(HasShielded(GIDEON, playId, 1)).toBe(true);
    });

    it("copies Support", async () => {
      const { playId } = await withDiscard(D_SUPPORT);
      expect(HasSupport(GIDEON, playId, 1)).toBe(true);
    });

    it("copies EVERY matching keyword at once, from several discarded units", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithCardInDiscardForPlayer(1, D_SENTINEL)
          .WithCardInDiscardForPlayer(1, D_OVERWHELM)
          .WithCardInDiscardForPlayer(1, D_SABOTEUR)
          .Build(),
      );
      const playId = await deployGideon(g);

      expect(HasSentinel(GIDEON, playId, 1)).toBe(true);
      expect(HasOverwhelm(GIDEON, playId, 1)).toBe(true);
      expect(HasSaboteur(GIDEON, playId, 1)).toBe(true);
      expect(HasGrit(GIDEON, playId, 1)).toBe(false);
    });

    it("does NOT copy Raid — it is not on the list", async () => {
      // LOF_132 Grand Inquisitor prints Hidden AND Raid 1. Hidden travels; Raid must not.
      const { playId } = await withDiscard("LOF_132");
      expect(HasHidden(GIDEON, playId, 1)).toBe(true);
      expect(RaidAmount(GIDEON, playId, 1)).toBe(0);
    });

    it("copies nothing from a NON-Imperial unit in the discard", async () => {
      // Redemption prints Sentinel, so this fails loudly if the Imperial filter is dropped.
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInDiscardForPlayer(1, NON_IMPERIAL).Build());
      const playId = await deployGideon(g);

      expect(HasSentinel(GIDEON, playId, 1)).toBe(false);
      expect(HasGrit(GIDEON, playId, 1)).toBe(false);
    });

    it("copies nothing from the OPPONENT's discard", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInDiscardForPlayer(2, D_SENTINEL).Build());
      const playId = await deployGideon(g);

      expect(HasSentinel(GIDEON, playId, 1)).toBe(false);
    });

    it("copies nothing with an empty discard", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().Build());
      const playId = await deployGideon(g);

      expect(HasSentinel(GIDEON, playId, 1)).toBe(false);
      expect(HasAmbush(GIDEON, playId, undefined, 1)).toBe(false);
    });

    it("the copied Sentinel really is live — enemy attacks are forced onto him", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithCardInDiscardForPlayer(1, D_SENTINEL)
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, WAMPA)
          .Build(),
      );
      const playId = await deployGideon(g);
      await g.dispatchAsync(1, "pass-action", {});

      await g.attackWithGroundUnitAsync(2, 0);
      const res = g.lastDispatchResponse?.resolutionNeeded;
      const offered = res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
      expect(offered).toEqual([playId]);
    });
  });

  describe("leader side Action", () => {
    it("plays a unit from hand for 1 less after a friendly Imperial unit died this phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, IMPERIAL_TROOPER) // 3/3 Imperial, dies attacking the Wampa
          .WithGroundUnitForPlayer(2, WAMPA)            // 4/5
          .WithCardInHandForPlayer(1, HAND_UNIT)        // cost 4, on-aspect
          .Build(),
      );
      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      await g.dispatchAsync(2, "pass-action", {});
      expect(g.state.player1.groundArena.some(u => u.cardId === IMPERIAL_TROOPER)).toBe(false);
      const before = spent(g);

      await g.dispatchAsync(1, "use-ability", { cardId: GIDEON });
      await g.chooseCardFromHandAsync(1, 0);

      expect(g.state.player1.groundArena.some(u => u.cardId === HAND_UNIT)).toBe(true);
      expect(spent(g) - before).toBe(3); // cost 4, one less
      expect(g.state.player1.leader.ready).toBe(false);
    });

    it("does nothing when no friendly Imperial unit was defeated this phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(base().WithCardInHandForPlayer(1, HAND_UNIT).Build());

      await g.dispatchAsync(1, "use-ability", { cardId: GIDEON });

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(g.state.player1.hand.some(c => c.cardId === HAND_UNIT)).toBe(true);
      expect(g.state.player1.groundArena).toHaveLength(0);
    });

    it("a defeated NON-Imperial friendly unit does not satisfy the condition", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        base()
          .WithGroundUnitForPlayer(1, MARINE) // 3/3 Rebel-ish, no Imperial trait
          .WithGroundUnitForPlayer(2, WAMPA)
          .WithCardInHandForPlayer(1, HAND_UNIT)
          .Build(),
      );
      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0);
      await g.dispatchAsync(2, "pass-action", {});
      expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(false);

      await g.dispatchAsync(1, "use-ability", { cardId: GIDEON });

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(g.state.player1.hand.some(c => c.cardId === HAND_UNIT)).toBe(true);
    });
  });

  it("cannot deploy below 7 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().FillResourcesForPlayer(1, MARINE, 0).Build(),
    );
    // base() already filled 20; rebuild with a short row instead.
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(GIDEON)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, MARINE, 6)
        .Build(),
    );

    await g.deployLeaderAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(0);
  });
});
