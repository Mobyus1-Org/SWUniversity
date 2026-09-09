import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   TWI_080 Poggle the Lesser — "When you play another unit: You may exhaust this unit. If you do,
//                                create a Battle Droid token."
//   TWI_154 Mister Bones      — "On Attack: If you have no cards in your hand, you may deal 3
//                                damage to a ground unit."
//   TWI_048 Obi-Wan's Aethersprite — "When Played/On Attack: You may deal 1 damage to this unit and
//                                2 damage to another space unit."

const POGGLE = Cards.units.twi.poggleTheLesser;   // 1/4 Ground
const BONES = Cards.units.twi.misterBones;        // 3/1 Ground
const AETHER = Cards.units.twi.obiWansAethersprite; // 4/6 Space
const DROID = Cards.units.token.battleDroid;
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;
const FRIGATE = "JTL_069";                        // Munificent Frigate 4/7 Space — survives 2

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

const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId);
};
const droids = (g: GameTestAdapter) => g.state.player1.groundArena.filter(u => u.cardId === DROID).length;

describe("TWI_080 Poggle the Lesser", () => {
  it("exhausts himself to create a Battle Droid when you play another unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, POGGLE).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(droids(g)).toBe(1);
    expect(find(g, 1, POGGLE)!.ready).toBe(false);
  });

  it("is optional — declining keeps him ready and makes no token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, POGGLE).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(droids(g)).toBe(0);
    expect(find(g, 1, POGGLE)!.ready).toBe(true);
  });

  it("does not fire off his OWN entry into play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, POGGLE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(droids(g)).toBe(0);
  });

  it("is not offered while he is already exhausted — the exhaust is the cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, POGGLE, false) // exhausted
        .WithCardInHandForPlayer(1, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(droids(g)).toBe(0);
  });
});

describe("TWI_154 Mister Bones — I Performed Violence", () => {
  it("deals 3 to a chosen ground unit on attack with an empty hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, BONES).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY)!.playId] });

    expect(find(g, 2, SECURITY)!.damage).toBe(3);
  });

  it("offers nothing while you hold a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, BONES)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithCardInHandForPlayer(1, MARINE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(find(g, 2, SECURITY)!.damage).toBe(0);
  });

  it("is optional", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, BONES).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(find(g, 2, SECURITY)!.damage).toBe(0);
  });

  it("cannot aim at a SPACE unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, BONES)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithSpaceUnitForPlayer(2, FRIGATE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    const offered = res?.type === "Target" ? (res.fromPlayIds ?? []) : [];

    expect(offered).not.toContain(find(g, 2, FRIGATE)!.playId);
    expect(offered).toContain(find(g, 2, SECURITY)!.playId);
  });
});

describe("TWI_048 Obi-Wan's Aethersprite", () => {
  it("deals 1 to itself and 2 to the chosen other space unit when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, AETHER).WithSpaceUnitForPlayer(2, FRIGATE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, FRIGATE)!.playId] });

    expect(find(g, 1, AETHER)!.damage).toBe(1);
    expect(find(g, 2, FRIGATE)!.damage).toBe(2);
  });

  it("is optional — declining damages nothing, itself included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, AETHER).WithSpaceUnitForPlayer(2, FRIGATE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(find(g, 1, AETHER)!.damage).toBe(0);
    expect(find(g, 2, FRIGATE)!.damage).toBe(0);
  });

  it("fires again on attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, AETHER).WithSpaceUnitForPlayer(2, FRIGATE).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, FRIGATE)!.playId] });

    expect(find(g, 1, AETHER)!.damage).toBe(1);
    expect(find(g, 2, FRIGATE)!.damage).toBe(2);
  });

  it("offers no GROUND unit and never itself — it says ANOTHER SPACE unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, AETHER)
        .WithSpaceUnitForPlayer(2, FRIGATE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    const offered = res?.type === "Target" ? (res.fromPlayIds ?? []) : [];

    expect(offered).toEqual([find(g, 2, FRIGATE)!.playId]);
  });

  it("offers nothing with no other space unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, AETHER).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(find(g, 1, AETHER)!.damage).toBe(0);
  });
});
