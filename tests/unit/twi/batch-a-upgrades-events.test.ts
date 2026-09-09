import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   TWI_070 Perilous Position   — -2/-2 Condition. "When Played: Exhaust attached unit."
//                                 No attach restriction, so ANY unit in play is a legal host.
//   TWI_155 Twice the Pride     — +4/+0. "When Played: Deal 2 damage to attached unit."
//   TWI_073 Grievous Reassembly — "Heal 3 damage from a unit. Create a Battle Droid token."
//   TWI_171 Grenade Strike      — "Deal 2 damage to a unit. You may deal 1 damage to another unit
//                                 in the same arena."
//   TWI_174 Open Fire           — "Deal 4 damage to a unit." (second printing of SOR_172)

const PERILOUS = Cards.upgrades.twi.perilousPosition;
const PRIDE = Cards.upgrades.twi.twiceThePride;
const REASSEMBLY = Cards.events.twi.grievousReassembly;
const GRENADE = Cards.events.twi.grenadeStrike;
const OPEN_FIRE = Cards.events.twi.openFireTwi;
const DROID = Cards.units.token.battleDroid;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7
const XWING = Cards.units.sor.wingLeader;               // Space

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
};
function find(g: GameTestAdapter, p: 1 | 2, cardId: string) {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId)!;
}

describe("TWI_070 Perilous Position", () => {
  it("exhausts the unit it attaches to", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, SECURITY).WithCardInHandForPlayer(1, PERILOUS).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, SECURITY).playId] });

    const host = find(g, 1, SECURITY);
    expect(host.ready).toBe(false);
    expect(host.upgrades.some(u => u.cardId === PERILOUS)).toBe(true);
  });

  it("carries its printed -2/-2 onto the host", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(PERILOUS, 1)])
        .Build(),
    );

    const host = Unit.FromInterface(find(g, 1, SECURITY));
    expect({ power: host.CurrentPower(), hp: host.TotalHP() }).toEqual({ power: 1, hp: 5 });
  });

  it("offers EVERY unit in play as a host — either player, either arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithSpaceUnitForPlayer(1, XWING)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithSpaceUnitForPlayer(2, XWING)
        .WithCardInHandForPlayer(1, PERILOUS)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const all = [
      ...g.state.player1.groundArena, ...g.state.player1.spaceArena,
      ...g.state.player2.groundArena, ...g.state.player2.spaceArena,
    ].map(u => u.playId);
    expect(offered(g).slice().sort()).toEqual(all.slice().sort());
  });
});

describe("TWI_155 Twice the Pride", () => {
  it("deals 2 damage to its host on play, and grants +4/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, SECURITY).WithCardInHandForPlayer(1, PRIDE).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, SECURITY).playId] });

    const raw = find(g, 1, SECURITY);
    expect(raw.damage).toBe(2);
    const host = Unit.FromInterface(raw);
    expect({ power: host.CurrentPower(), hp: host.TotalHP() }).toEqual({ power: 7, hp: 7 });
  });

  it("can be lethal to a small host", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, DROID) // 1/1 token
        .WithCardInHandForPlayer(1, PRIDE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, DROID).playId] });

    expect(g.state.player1.groundArena.some(u => u.cardId === DROID)).toBe(false);
  });
});

describe("TWI_073 Grievous Reassembly", () => {
  it("heals 3 from the chosen unit and creates a Battle Droid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, SECURITY).WithCardInHandForPlayer(1, REASSEMBLY).Build(),
    );
    find(g, 1, SECURITY).damage = 5;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, SECURITY).playId] });

    expect(find(g, 1, SECURITY).damage).toBe(2);
    expect(g.state.player1.groundArena.filter(u => u.cardId === DROID)).toHaveLength(1);
  });

  it("still creates the Droid with no unit to heal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, REASSEMBLY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.filter(u => u.cardId === DROID)).toHaveLength(1);
  });
});

describe("TWI_171 Grenade Strike", () => {
  it("deals 2, then 1 to another unit in the same arena when accepted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithCardInHandForPlayer(1, GRENADE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY).playId] });
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, MARINE).playId] });

    expect(find(g, 2, SECURITY).damage).toBe(2);
    expect(find(g, 2, MARINE).damage).toBe(1);
  });

  it("the second hit is optional", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithGroundUnitForPlayer(2, MARINE)
        .WithCardInHandForPlayer(1, GRENADE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY).playId] });
    await g.chooseNoAsync(1);

    expect(find(g, 2, SECURITY).damage).toBe(2);
    expect(find(g, 2, MARINE).damage).toBe(0);
  });

  it("offers no second hit when the only other unit is in a DIFFERENT arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithSpaceUnitForPlayer(2, XWING)
        .WithCardInHandForPlayer(1, GRENADE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY).playId] });

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(find(g, 2, XWING).damage).toBe(0);
  });
});

describe("TWI_174 Open Fire", () => {
  it("deals 4 damage to the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(2, SECURITY).WithCardInHandForPlayer(1, OPEN_FIRE).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY).playId] });

    expect(find(g, 2, SECURITY).damage).toBe(4);
  });
});
