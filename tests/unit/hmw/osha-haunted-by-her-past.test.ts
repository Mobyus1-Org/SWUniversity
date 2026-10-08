import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// HMW_017 Osha — Haunted By Her Past (Leader, cost 6, 5/6 Ground, Cunning/Heroism, Force)
// Front:  Action [Exhaust]: If a friendly Heroism unit was defeated this phase, play a Villainy
//         unit from your resources, ignoring its Villainy aspect penalties. If you do, you may
//         resource a card from your hand.
//         Epic Action: If you control 6 or more resources, deploy this leader.
// Deployed: Saboteur
//           Action: Play a Villainy unit from your resources, ignoring its Villainy aspect
//           penalties. If you do, you may resource a card from your hand.
//
// Every cost below is read under a CUNNING base with Osha supplying Cunning + Heroism, so the
// provided aspects are {Cunning, Cunning, Heroism} and the Villainy waiver is a visible number:
//   Death Trooper Squad  (ASH_242) cost 4, Villainy          -> 6 unwaived, 4 waived
//   Peridea Bandit       (ASH_190) cost 2, Cunning+Villainy  -> 4 unwaived, 2 waived
//   First Legion Trooper (IBH_055) cost 3, Vigilance+Villainy-> 7 unwaived, 5 waived (Vigilance
//                                                               is NOT Villainy, so it still bites)
const OSHA = Cards.leaders.hmw.osha;
const VILLAINY_UNIT = Cards.units.ash.deathTrooperSquad;
const VILLAINY_CHEAP = Cards.units.ash.perideaBandit;
const VILLAINY_OFF_ASPECT = Cards.units.ibh.firstLegionTrooper;
const HEROISM_UNIT = Cards.units.sor.battlefieldMarine; // 3/3, Command+Heroism
const WAMPA = Cards.units.sor.wampa;                    // 4/5 — kills a Marine in combat

function setup(resources = 10) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP) // Administrator's Tower — Cunning
    .MyLeader(OSHA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, HEROISM_UNIT, resources)
    .WithActivePlayer(1);
  for (let i = 0; i < 4; i++) b = b.WithCardInDeckForPlayer(1, HEROISM_UNIT);
  return b;
}

/** Swaps one of P1's resources for `cardId` so it can be played out of the resource row. */
function resourceIs(g: GameTestAdapter, cardId: string, index = 0): string {
  const r = g.state.player1.resources[index];
  r.cardId = cardId;
  return r.playId;
}

const useOsha = (g: GameTestAdapter) => g.dispatchAsync(1, "use-ability", { cardId: OSHA });
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const offeredPlayIds = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined)?.fromPlayIds;
const promptOptions = (g: GameTestAdapter): string[] | undefined => {
  const r = g.lastDispatchResponse?.resolutionNeeded;
  return r && "options" in r ? (r.options as string[]) : undefined;
};
const inArena = (g: GameTestAdapter, cardId: string) =>
  [...g.state.player1.groundArena, ...g.state.player1.spaceArena].some(u => u.cardId === cardId);

/** Kills P1's own Heroism Marine in combat, satisfying Osha's condition. Ends with P1 to act. */
async function killOwnHeroismUnit(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0); // the Marine
  await g.chooseGroundUnitAsync(2, 0);     // into the Wampa — 3 power vs 5 HP, Marine dies
  await g.dispatchAsync(2, "pass-action", {});
}

describe("HMW_017 Osha — front Action", () => {
  function conditionMetSetup(resources = 10) {
    return setup(resources)
      .WithGroundUnitForPlayer(1, HEROISM_UNIT)
      .WithGroundUnitForPlayer(2, WAMPA);
  }

  it("plays a Villainy unit from resources ignoring its Villainy penalty, then resources a card from hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(conditionMetSetup().WithCardInHandForPlayer(1, HEROISM_UNIT).Build());
    const villainId = resourceIs(g, VILLAINY_UNIT);
    const totalBefore = g.state.player1.resources.length;

    await killOwnHeroismUnit(g);
    await useOsha(g);
    expect(offeredPlayIds(g)).toEqual([villainId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainId] });

    // Cost 4 waived (6 unwaived): the Villainy pips are ignored, nothing else is.
    expect(readyResources(g)).toBe(totalBefore - 1 - 4);
    expect(inArena(g, VILLAINY_UNIT)).toBe(true);
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust is the cost

    // "If you do, you may resource a card from your hand." — accept it.
    expect(promptOptions(g)).toContain("0");
    await g.chooseOptionAsync(1, "0");

    expect(g.state.player1.hand).toHaveLength(0);
    // One card left the row for the unit, one joined it from hand: net unchanged.
    expect(g.state.player1.resources).toHaveLength(totalBefore);
  });

  it("the waiver is only for Villainy — an unmatched Vigilance pip still costs 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(conditionMetSetup().Build());
    const trooperId = resourceIs(g, VILLAINY_OFF_ASPECT);
    const totalBefore = g.state.player1.resources.length;

    await killOwnHeroismUnit(g);
    await useOsha(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [trooperId] });

    // Printed 3 + 2 for the uncovered Vigilance = 5. Unwaived it would have been 7.
    expect(readyResources(g)).toBe(totalBefore - 1 - 5);
    expect(inArena(g, VILLAINY_OFF_ASPECT)).toBe(true);
  });

  it("the waiver holds at a second cost point", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(conditionMetSetup().Build());
    const banditId = resourceIs(g, VILLAINY_CHEAP);
    const totalBefore = g.state.player1.resources.length;

    await killOwnHeroismUnit(g);
    await useOsha(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [banditId] });

    expect(readyResources(g)).toBe(totalBefore - 1 - 2); // printed 2, Villainy pip ignored
  });

  it("the resource-a-card tail may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(conditionMetSetup().WithCardInHandForPlayer(1, HEROISM_UNIT).Build());
    const villainId = resourceIs(g, VILLAINY_UNIT);
    const totalBefore = g.state.player1.resources.length;

    await killOwnHeroismUnit(g);
    await useOsha(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainId] });

    // The offer must really be open, or "declining" would be a silent no-op.
    expect(promptOptions(g)).toContain("skip");
    await g.chooseOptionAsync(1, "skip");

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.resources).toHaveLength(totalBefore - 1); // only the played card left
  });

  it("no tail prompt when the hand is empty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(conditionMetSetup().Build()); // no hand
    const villainId = resourceIs(g, VILLAINY_UNIT);

    await killOwnHeroismUnit(g);
    await useOsha(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainId] });

    expect(inArena(g, VILLAINY_UNIT)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("the condition is satisfied when the OPPONENT defeated the friendly Heroism unit", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(1, HEROISM_UNIT)
      .WithGroundUnitForPlayer(2, WAMPA)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);
    const villainId = resourceIs(g, VILLAINY_UNIT);

    await g.attackWithGroundUnitAsync(2, 0); // the Wampa kills P1's Marine
    await g.chooseGroundUnitAsync(1, 0);

    await useOsha(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainId] });

    expect(inArena(g, VILLAINY_UNIT)).toBe(true);
  });

  it("the condition is satisfied by a friendly Heroism TOKEN unit", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper) // 2/2, Heroism
      .WithGroundUnitForPlayer(2, WAMPA)
      .Build();
    g.loadNewState(state);
    const villainId = resourceIs(g, VILLAINY_UNIT);

    await g.attackWithGroundUnitAsync(1, 0); // the token dies to the Wampa's 4 power
    await g.chooseGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});

    await useOsha(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainId] });

    expect(inArena(g, VILLAINY_UNIT)).toBe(true);
  });

  it("soft pass: an ENEMY Heroism unit dying does not satisfy it", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(1, WAMPA)          // P1 attacks with the Wampa
      .WithGroundUnitForPlayer(2, HEROISM_UNIT)   // the enemy Marine dies
      .Build();
    g.loadNewState(state);
    resourceIs(g, VILLAINY_UNIT);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});

    await useOsha(g);

    expect(g.state.player1.leader.ready).toBe(false); // the Exhaust was still paid
    expect(inArena(g, VILLAINY_UNIT)).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("soft pass: a friendly NON-Heroism unit dying does not satisfy it", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid) // 1/1, Villainy
      .WithGroundUnitForPlayer(2, WAMPA)
      .Build();
    g.loadNewState(state);
    resourceIs(g, VILLAINY_UNIT);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});

    await useOsha(g);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(inArena(g, VILLAINY_UNIT)).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("soft pass: nothing defeated at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    resourceIs(g, VILLAINY_UNIT);

    await useOsha(g);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(inArena(g, VILLAINY_UNIT)).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined(); // never even offered a target
  });

  it("cannot be used while already exhausted", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .MyLeader(OSHA, false) // exhausted
      .WithGroundUnitForPlayer(1, HEROISM_UNIT)
      .WithGroundUnitForPlayer(2, WAMPA)
      .Build();
    g.loadNewState(state);
    const villainId = resourceIs(g, VILLAINY_UNIT);

    await killOwnHeroismUnit(g);
    await useOsha(g);

    expect(inArena(g, VILLAINY_UNIT)).toBe(false);
    expect(g.state.player1.resources.some(r => r.playId === villainId)).toBe(true);
  });

  it("Epic Action: deploys at 6 resources, refused at 5", async () => {
    const gYes = new GameTestAdapter();
    gYes.loadNewState(setup(6).Build());
    await gYes.deployLeaderAsync(1);
    expect(gYes.state.player1.leader.deployed).toBe(true);

    const gNo = new GameTestAdapter();
    gNo.loadNewState(setup(5).Build());
    await gNo.deployLeaderAsync(1);
    expect(gNo.state.player1.leader.deployed).toBe(false);
  });
});

describe("HMW_017 Osha — deployed side", () => {
  /** Osha already deployed, as a unit in P1's ground arena. */
  function deployedSetup(resources = 10) {
    return setup(resources)
      .MyLeader(OSHA, true, true)
      .WithGroundUnitForPlayer(1, OSHA);
  }

  const useOshaUnit = (g: GameTestAdapter) => {
    const osha = g.state.player1.groundArena.find(u => u.cardId === OSHA)!;
    return g.dispatchAsync(1, "use-ability", { cardId: OSHA, playId: osha.playId });
  };

  it("has Saboteur", () => {
    expect(HasSaboteur(OSHA)).toBe(true);
  });

  it("plays a Villainy unit from resources with no Heroism condition", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());
    const villainId = resourceIs(g, VILLAINY_UNIT);
    const totalBefore = g.state.player1.resources.length;

    await useOshaUnit(g); // nothing was defeated this phase — the deployed side does not care
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainId] });

    expect(inArena(g, VILLAINY_UNIT)).toBe(true);
    expect(readyResources(g)).toBe(totalBefore - 1 - 4);
  });

  it("has no cost, so using it does not exhaust Osha", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());
    const villainId = resourceIs(g, VILLAINY_UNIT);

    await useOshaUnit(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainId] });

    const osha = g.state.player1.groundArena.find(u => u.cardId === OSHA)!;
    expect(osha.ready).toBe(true);
  });

  it("the resource row drops by exactly one — no replacement is drawn from the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build()); // empty hand, so no tail prompt
    const villainId = resourceIs(g, VILLAINY_UNIT);
    const totalBefore = g.state.player1.resources.length;
    const deckBefore = g.state.player1.deck.length;

    await useOshaUnit(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainId] });

    expect(g.state.player1.resources).toHaveLength(totalBefore - 1);
    expect(g.state.player1.deck).toHaveLength(deckBefore);
  });

  it("offers only Villainy UNITS in the resource row", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build());
    const villainId = resourceIs(g, VILLAINY_UNIT, 0);
    resourceIs(g, HEROISM_UNIT, 1);                  // a unit, but not Villainy
    resourceIs(g, Cards.events.shd.daringRaid, 2);   // Villainy-adjacent but not a unit
    const banditId = resourceIs(g, VILLAINY_CHEAP, 3);

    await useOshaUnit(g);

    expect(offeredPlayIds(g)?.sort()).toEqual([villainId, banditId].sort());
  });

  it("is not offered at all with no Villainy unit in the resource row", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().Build()); // every resource is a Battlefield Marine

    await useOshaUnit(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.resources).toHaveLength(10);
  });

  it("does not reach a Villainy unit in hand or discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup()
      .WithCardInHandForPlayer(1, VILLAINY_UNIT)
      .WithCardInDiscardForPlayer(1, VILLAINY_CHEAP)
      .Build());

    await useOshaUnit(g);

    // Only the resource row is a legal source, and it holds no Villainy unit.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(inArena(g, VILLAINY_UNIT)).toBe(false);
    expect(inArena(g, VILLAINY_CHEAP)).toBe(false);
  });

  it("does not offer a Villainy unit it cannot afford", async () => {
    const g = new GameTestAdapter();
    // Three resources: the Villainy unit itself plus two others, so 2 left to pay a waived 4.
    g.loadNewState(deployedSetup(3).Build());
    resourceIs(g, VILLAINY_UNIT);

    await useOshaUnit(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(inArena(g, VILLAINY_UNIT)).toBe(false);
  });
});

describe("HMW_017 Osha — ability ordering", () => {
  it("resources a card from hand BEFORE the played unit's When Played resolves", async () => {
    // Osha's tail is part of HER ability; the played unit's When Played is a new trigger that
    // waits for her to finish. IG-2000 is the right probe: its only entry trigger is an
    // interactive When Played ("deal 1 damage to each of up to 3 units") with no Ambush or
    // Shielded alongside it, so the engine hands that trigger straight back rather than bagging
    // it. If Osha did not hold it, it would be dropped on the floor instead of merely reordered.
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .MyLeader(OSHA, true, true)
      .WithGroundUnitForPlayer(1, OSHA)
      .WithCardInHandForPlayer(1, HEROISM_UNIT)
      .Build());
    const igId = resourceIs(g, Cards.units.jtl.ig2000);
    const totalBefore = g.state.player1.resources.length;

    await g.dispatchAsync(1, "use-ability", {
      cardId: OSHA,
      playId: g.state.player1.groundArena.find(u => u.cardId === OSHA)!.playId,
    });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [igId] });

    // Printed 4 + 2 for the uncovered Aggression = 6; the Villainy pip is the only one forgiven.
    expect(readyResources(g)).toBe(totalBefore - 1 - 6);
    // Osha's own prompt comes first — one option per hand card, plus Skip.
    expect(promptOptions(g)).toEqual(["skip", "0"]);
    await g.chooseOptionAsync(1, "skip");

    // Only now does IG-2000's When Played arrive, and it is still a live target prompt.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    expect(inArena(g, Cards.units.jtl.ig2000)).toBe(true);
  });
});
