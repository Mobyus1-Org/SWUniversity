import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_008 General Grievous — Separatist Warlord (Leader, Command/Villainy, Separatist/Official;
// 3/6 Ground unit)
//   Front:    "Action [Exhaust]: Play 2 units from your hand (one at a time, paying their costs).
//              Epic Action: If you control 5 or more resources, deploy this leader."
//   Deployed: "While you control more units than an opponent, this unit gets +3/+0."
//
// Playing from hand is always declinable (the hand is hidden), so either pick can be "Choose
// nothing". The second offer is worked out only after the first unit has fully resolved — its own
// When Played included — and after it has spent its resources.

const GRIEVOUS = Cards.leaders.hmw.generalGrievousSeparatistWarlord;
const COURIER = Cards.units.twi.confederateCourier;   // 2/1 Space, cost 2, no penalty here
const TROOPER = Cards.units.shd.deathTrooperShd;      // 3/3 Ground, cost 3; WP: 2 to a friendly and an enemy ground unit
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;

function base(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)          // Vigilance — covers Death Trooper
    .MyLeader(GRIEVOUS)                           // Command/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

type Res = { type?: string; fromZones?: string[]; fromIndices?: number[]; optional?: boolean; fromPlayIds?: string[] };
const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as Res;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const isHandOffer = (g: GameTestAdapter) => res(g)?.type === "Target" && (res(g).fromZones ?? []).includes("Hand");
const chooseNothing = (g: GameTestAdapter) => g.dispatchAsync(1, "choose-target", { targetIndices: [] });

describe("HMW_008 General Grievous — front: play 2 units from your hand", () => {
  it("plays two units, one at a time, each paying its own cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, COURIER).WithCardInHandForPlayer(1, COURIER).Build());

    await g.useLeaderAbilityAsync(1);
    expect(isHandOffer(g)).toBe(true);
    expect(res(g).optional).toBe(true);
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.spaceArena).toHaveLength(1);
    expect(isHandOffer(g)).toBe(true);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(2);
    expect(readyResources(g)).toBe(4);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.activePlayer).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("offers only unit cards", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithCardInHandForPlayer(1, COURIER)
      .WithCardInHandForPlayer(1, Cards.events.sor.confiscate)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.entrenched)
      .Build());

    await g.useLeaderAbilityAsync(1);

    expect(res(g).fromIndices).toEqual([0]);
  });

  it("the first unit's own When Played, targeting included, resolves before the second offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithCardInHandForPlayer(1, TROOPER)
      .WithCardInHandForPlayer(1, COURIER)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);           // Death Trooper
    expect(isHandOffer(g)).toBe(false);              // its When Played is asking first
    await g.chooseGroundUnitAsync(1, 0);             // 2 to a friendly ground unit (itself)
    await g.chooseGroundUnitAsync(2, 0);             // 2 to an enemy ground unit
    expect(g.state.player2.groundArena[0].damage).toBe(2);

    expect(isHandOffer(g)).toBe(true);               // now the second play
    await g.chooseCardFromHandAsync(1, 0);           // Courier
    expect(g.state.player1.spaceArena).toHaveLength(1);
  });

  it("with only one unit in hand, plays it and ends", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, COURIER).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.activePlayer).toBe(2);
  });

  it("the second offer is worked out after the first play paid: with 2 resources, only one cost-2 unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(2).WithCardInHandForPlayer(1, COURIER).WithCardInHandForPlayer(1, COURIER).Build());

    await g.useLeaderAbilityAsync(1);
    expect(res(g).fromIndices).toEqual([0, 1]);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy(); // nothing affordable is left to offer
    expect(g.state.player1.spaceArena).toHaveLength(1);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([COURIER]);
    expect(g.state.activePlayer).toBe(2);
  });

  it("the second play can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, COURIER).WithCardInHandForPlayer(1, COURIER).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await chooseNothing(g);

    expect(g.state.player1.spaceArena).toHaveLength(1);
    expect(g.state.player1.hand).toHaveLength(1);
    expect(readyResources(g)).toBe(6);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.activePlayer).toBe(2); // one action — the turn passes exactly once
  });

  it("the first play can be declined too: nothing played, but Grievous is still exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, COURIER).Build());

    await g.useLeaderAbilityAsync(1);
    await chooseNothing(g);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(readyResources(g)).toBe(8);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("with no unit in hand the Action still exhausts him and does nothing else", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.events.sor.confiscate).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.activePlayer).toBe(2);
  });

  it("deploys with 5 resources, not 4", async () => {
    const four = new GameTestAdapter();
    four.loadNewState(base(4).Build());
    await four.deployLeaderAsync(1);
    expect(four.state.player1.leader.deployed).toBe(false);

    const five = new GameTestAdapter();
    five.loadNewState(base(5).Build());
    await five.deployLeaderAsync(1);
    expect(five.state.player1.leader.deployed).toBe(true);
  });
});

describe("HMW_008 General Grievous — deployed: +3/+0 while you control more units than an opponent", () => {
  function deployed() {
    return base().MyLeader(GRIEVOUS, true, true).WithGroundUnitForPlayer(1, GRIEVOUS);
  }
  const grievousPower = (g: GameTestAdapter) =>
    Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === GRIEVOUS)!).CurrentPower();

  it("more units (2 vs 1): 6 power", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());
    expect(grievousPower(g)).toBe(6);
  });

  it("equal units (1 vs 1): no buff — 'more', not 'as many'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(2, MARINE).Build());
    expect(grievousPower(g)).toBe(3);
  });

  it("fewer units (1 vs 2): no buff", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());
    expect(grievousPower(g)).toBe(3);
  });

  it("recomputes as the counts change", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed()
      .WithActivePlayer(2)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(2, MARINE)
      .FillResourcesForPlayer(2, MARINE, 5)
      .Build());
    expect(grievousPower(g)).toBe(6);

    await g.playCardFromHandAsync(2, 0); // the opponent catches up, 2 vs 2

    expect(grievousPower(g)).toBe(3);
  });
});
