import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TraitContains, UnitTitle, UnitTraits } from "@/server/engine/core-functions";
import { PilotingEligibleVehicles } from "@/server/engine/card-db/upgrade-attach-restrictions";

// HMW_004 Grand Moff Tarkin — Tyrant of the Outer Rim (Leader, Vigilance/Villainy, Imperial/Official)
//   Front:    "Ignore the aspect penalties on upgrades with Fortify you play.
//              Epic Action: If you control 9 or more resources, deploy this leader."
//   Deployed: The Death Star — Icon of Tyranny (2/12 Space; Imperial, Vehicle, Capital Ship)
//             "Ignore the aspect penalties on upgrades with Fortify you play.
//              When the regroup phase starts: You may defeat a base with 10 or less remaining HP."
//
// FFG publishes only the front's title and traits; the deployed side's come from a hand-kept entry.

const TARKIN = Cards.leaders.hmw.grandMoffTarkin;
const TRAP_FIELD = Cards.upgrades.hmw.trapField;          // Fortify, cost 2, Aggression/Heroism
const NON_FORTIFY = Cards.upgrades.ash.unfetteredAmbition; // cost 2, Aggression — not Fortify
const MARINE = Cards.units.sor.battlefieldMarine;

function base(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)   // Vigilance — Aggression/Heroism stay uncovered
    .MyLeader(TARKIN)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithInitiativePlayerBeing(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

/** Two cards each, so the regroup draw never adds empty-deck damage. */
function withDecks(b: GameStateBuilder) {
  return b.WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(2, MARINE).WithCardInDeckForPlayer(2, MARINE);
}

const deathStar = (g: GameTestAdapter) => g.state.player1.spaceArena.find(u => u.cardId === TARKIN)!;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
type Res = { type?: string; fromPlayIds?: string[] };
const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as Res;

/** Deploys Tarkin (P1's action), then P2 passes, then P1 passes — the regroup phase starts. */
async function deployThenRegroup(g: GameTestAdapter) {
  await g.deployLeaderAsync(1);
  await g.dispatchAsync(2, "pass-action", {});
  await g.dispatchAsync(1, "pass-action", {});
}

describe("HMW_004 Grand Moff Tarkin — front", () => {
  it("deploys with 9 resources, into the space arena, without spending them", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(9).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(deathStar(g)).toBeDefined();
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(readyResources(g)).toBe(9);
  });

  it("can't deploy with 8 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(8).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
    expect(g.state.player1.spaceArena).toHaveLength(0);
  });

  it("a Fortify upgrade ignores its aspect penalty: Trap Field costs its printed 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(2).WithCardInHandForPlayer(1, TRAP_FIELD).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] }); // Fortify → your base

    expect(g.state.player1.base.upgrades?.map(u => u.cardId)).toEqual([TRAP_FIELD]);
    expect(readyResources(g)).toBe(0);
  });

  it("a non-Fortify upgrade still pays its penalty (2 + 2 = 4, unaffordable with 2)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(2)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithCardInHandForPlayer(1, NON_FORTIFY)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([NON_FORTIFY]);
    expect(readyResources(g)).toBe(2);
  });

  it("control: with another leader, Trap Field pays its penalty (2 + 4 = 6)", async () => {
    const g = new GameTestAdapter();
    const s = base(2).WithCardInHandForPlayer(1, TRAP_FIELD).Build();
    s.player1.leader.cardId = Cards.leaders.sor.grandMoffTarkin; // Command/Villainy, no waiver
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([TRAP_FIELD]);
  });

  it("while undeployed he has the FRONT's traits", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(2).Build());

    expect(TraitContains(TARKIN, "Official", 1)).toBe(true);
    expect(TraitContains(TARKIN, "Vehicle", 1)).toBe(false);
  });
});

describe("HMW_004 — deployed as The Death Star", () => {
  it("is titled The Death Star, and its traits REPLACE the front's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(9).Build());
    await g.deployLeaderAsync(1);
    const unit = deathStar(g);

    expect(UnitTitle(unit)).toBe("The Death Star");
    expect([...UnitTraits(unit)].sort()).toEqual(["Capital Ship", "Imperial", "Vehicle"]);
    expect(TraitContains(unit.cardId, "Vehicle", 1, unit.playId)).toBe(true);
    expect(TraitContains(unit.cardId, "Capital Ship", 1, unit.playId)).toBe(true);
    expect(TraitContains(unit.cardId, "Official", 1, unit.playId)).toBe(false);
    expect(TraitContains(unit.cardId, "Vehicle")).toBe(true); // no player/playId: still the unit side
  });

  it("is a Vehicle a Pilot can attach to", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(9).Build());
    await g.deployLeaderAsync(1);

    expect(PilotingEligibleVehicles(g.state, 1, Cards.units.jtl.nienNunb)).toContain(deathStar(g).playId);
  });

  it("still waives Fortify penalties", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(11).WithCardInHandForPlayer(1, TRAP_FIELD).Build());
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.upgrades?.map(u => u.cardId)).toEqual([TRAP_FIELD]);
    expect(readyResources(g)).toBe(9); // 11 − 2
  });

  it("Annihilator defeating it searches for 'The Death Star', not 'Grand Moff Tarkin'", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(TARKIN)
      .WithActivePlayer(2)
      .FillResourcesForPlayer(1, MARINE, 12)
      .FillResourcesForPlayer(2, MARINE, 9)
      .WithCardInHandForPlayer(1, Cards.units.jtl.annihilator)
      .WithCardInHandForPlayer(2, Cards.units.sor.grandMoffTarkinUnit) // "Grand Moff Tarkin"
      .Build();
    g.loadNewState(s);

    await g.deployLeaderAsync(2);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });

    expect(g.state.player2.leader.deployed).toBe(false);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([Cards.units.sor.grandMoffTarkinUnit]);
  });
});

describe("HMW_004 — When the regroup phase starts: you may defeat a base with 10 or less remaining HP", () => {
  it("offers an enemy base with exactly 10 remaining; defeating it wins the game", async () => {
    const g = new GameTestAdapter();
    const s = withDecks(base(9)).Build();
    s.player2.base.damage = 20;
    g.loadNewState(s);

    await deployThenRegroup(g);

    expect(res(g).type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(res(g).fromPlayIds).toEqual(["player2.base"]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });

    expect(g.state.defeatedPlayers).toEqual([2]);
  });

  it("your own base qualifies too", async () => {
    const g = new GameTestAdapter();
    const s = withDecks(base(9)).Build();
    s.player1.base.damage = 25;
    g.loadNewState(s);

    await deployThenRegroup(g);
    await g.chooseYesAsync(1);
    expect(res(g).fromPlayIds).toEqual(["player1.base"]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.defeatedPlayers).toEqual([1]);
  });

  it("declining leaves the base alone, and the regroup carries on (draw happens after)", async () => {
    const g = new GameTestAdapter();
    const s = withDecks(base(9)).Build();
    s.player2.base.damage = 20;
    g.loadNewState(s);
    const handBefore = g.state.player1.hand.length;

    await deployThenRegroup(g);
    // The draw waits for the start-of-regroup choice.
    expect(g.state.gamePhase).toBe("RegroupDraw");
    expect(g.state.player1.hand.length).toBe(handBefore);

    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(20);
    expect(g.state.defeatedPlayers).toEqual([]);
    expect(g.state.gamePhase).toBe("RegroupResource");
    expect(g.state.player1.hand.length).toBe(handBefore + 2);
  });

  it("a base with 11 remaining isn't offered", async () => {
    const g = new GameTestAdapter();
    const s = withDecks(base(9)).Build();
    s.player2.base.damage = 19;
    g.loadNewState(s);

    await deployThenRegroup(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.gamePhase).toBe("RegroupResource");
  });

  it("the offer is made BEFORE the regroup draw: empty-deck damage can't push a base into range first", async () => {
    const g = new GameTestAdapter();
    const s = base(9).WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE).Build();
    s.player2.base.damage = 18; // 12 remaining now; P2's empty deck will cost 6 when they draw
    g.loadNewState(s);

    await deployThenRegroup(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(24);
    expect(g.state.defeatedPlayers).toEqual([]);
  });

  it("an undeployed Tarkin offers nothing", async () => {
    const g = new GameTestAdapter();
    const s = withDecks(base(9)).Build();
    s.player2.base.damage = 25;
    g.loadNewState(s);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.defeatedPlayers).toEqual([]);
  });
});
