import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// The "for this phase" stat-modifier corner of TWI.
//
//   TWI_063 Vulture Interceptor Wing — "On Attack: Give an enemy unit –1/–1 for this phase."
//   TWI_075 Disruptive Burst         — "Give each enemy unit –1/–1 for this phase."
//   TWI_126 Encouraging Leadership   — "Give each friendly unit +1/+1 for this phase."
//   TWI_084 Kraken                   — "When Played: Create 2 Battle Droid tokens.
//                                       On Attack: Give each friendly token unit +1/+1 for this phase."

const VULTURE = Cards.units.twi.vultureInterceptorWing; // 3/3 Space
const KRAKEN = Cards.units.twi.kraken;                  // 2/5 Ground
const DROID = Cards.units.token.battleDroid;            // 1/1 token
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3 Ground
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const XWING = Cards.units.sor.wingLeader;               // Space

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

function stats(g: GameTestAdapter, p: 1 | 2, cardId: string) {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  const raw = [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId)!;
  const u = Unit.FromInterface(raw);
  return { power: u.CurrentPower(), hp: u.TotalHP() };
}

describe("TWI_063 Vulture Interceptor Wing", () => {
  it("gives the chosen enemy unit –1/–1 on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, VULTURE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const victim = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [victim] });

    expect(stats(g, 2, SECURITY)).toEqual({ power: 2, hp: 6 });
  });

  it("cannot aim at a FRIENDLY unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, VULTURE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    const offered = res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
    expect(offered).not.toContain(g.state.player1.groundArena[0].playId);
  });
});

describe("TWI_075 Disruptive Burst", () => {
  it("gives –1/–1 to every enemy unit across both arenas, and none to friendlies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.twi.disruptiveBurst)
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithSpaceUnitForPlayer(2, XWING)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(stats(g, 2, SECURITY)).toEqual({ power: 2, hp: 6 });
    expect(stats(g, 2, XWING).power).toBe(Unit.FromInterface(
      { ...g.state.player2.spaceArena[0] }).CurrentPower());
    expect(stats(g, 1, SECURITY)).toEqual({ power: 3, hp: 7 });
  });
});

describe("TWI_126 Encouraging Leadership", () => {
  it("gives +1/+1 to every friendly unit across both arenas, and none to enemies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.twi.encouragingLeadership)
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithSpaceUnitForPlayer(1, XWING)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );
    const xwingBefore = stats(g, 1, XWING);

    await g.playCardFromHandAsync(1, 0);

    expect(stats(g, 1, SECURITY)).toEqual({ power: 4, hp: 8 });
    expect(stats(g, 1, XWING)).toEqual({ power: xwingBefore.power + 1, hp: xwingBefore.hp + 1 });
    expect(stats(g, 2, SECURITY)).toEqual({ power: 3, hp: 7 });
  });
});

describe("TWI_084 Kraken — Confederate Tactician", () => {
  it("creates 2 Battle Droid tokens when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, KRAKEN).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.filter(u => u.cardId === DROID)).toHaveLength(2);
  });

  it("buffs each friendly TOKEN unit on attack, leaving non-tokens alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, KRAKEN)
        .WithGroundUnitForPlayer(1, DROID)
        .WithGroundUnitForPlayer(1, SECURITY)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(stats(g, 1, DROID)).toEqual({ power: 2, hp: 2 });
    expect(stats(g, 1, SECURITY)).toEqual({ power: 3, hp: 7 });
  });

  it("does not buff an ENEMY token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, KRAKEN)
        .WithGroundUnitForPlayer(2, DROID)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(stats(g, 2, DROID)).toEqual({ power: 1, hp: 1 });
  });
});
