import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   ASH_136 Display of Strength — "Give a unit +3/+3 for this phase."
//   ASH_081 Nebulon-C Frigate   — "When Played: You MAY heal 3 damage from a unit OR base."
//   ASH_065 Home One            — Sentinel + "When Played: Heal all damage from each friendly unit."
//   ASH_221 Helix Starfighter   — "When Played: If an opponent controls a space unit, give a Shield
//                                  token to this unit. Otherwise, give 2 Advantage tokens to it."
//   ASH_044 Barriss Offee       — "When Played: Heal up to 2 damage from a unit. Give an Advantage
//                                  token to it for each damage HEALED THIS WAY."

const DISPLAY = Cards.events.ash.displayOfStrength;
const NEBULON = Cards.units.ash.nebulonCFrigate;
const HOME_ONE = Cards.units.ash.homeOne;
const HELIX = Cards.units.ash.helixStarfighter;
const BARRISS = Cards.units.ash.barrissOffee;
const SHIELD = Cards.upgrades.token.shield;
const ADVANTAGE = Cards.upgrades.token.advantage;
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7
const FRIGATE = "JTL_069";                              // 4/7 Space

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 6)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId);
};
const tokens = (g: GameTestAdapter, p: 1 | 2, cardId: string, token: string) =>
  find(g, p, cardId)?.upgrades.filter(u => u.cardId === token).length ?? 0;

describe("ASH_136 Display of Strength", () => {
  it("gives the chosen unit +3/+3 for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, DISPLAY).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE)!.playId] });

    const u = Unit.FromInterface(find(g, 1, MARINE)!);
    expect(u.CurrentPower()).toBe(6);
    expect(u.TotalHP()).toBe(6);
  });

  it("can target an enemy unit — it says 'a unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, DISPLAY).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    const offered = res?.type === "Target" ? (res.fromPlayIds ?? []) : [];

    expect(offered).toContain(find(g, 2, MARINE)!.playId);
  });
});

describe("ASH_081 Nebulon-C Frigate", () => {
  it("heals 3 from the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, NEBULON).WithGroundUnitForPlayer(1, SECURITY).Build());
    find(g, 1, SECURITY)!.damage = 5;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, SECURITY)!.playId] });

    expect(find(g, 1, SECURITY)!.damage).toBe(2);
  });

  it("can heal a BASE instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, NEBULON).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(3); // 6 - 3
  });

  it("is optional", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, NEBULON).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.base.damage).toBe(6);
  });
});

describe("ASH_065 Home One", () => {
  it("heals ALL damage from each friendly unit, and none from the enemy's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, HOME_ONE)
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithSpaceUnitForPlayer(1, FRIGATE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );
    find(g, 1, SECURITY)!.damage = 4;
    find(g, 1, FRIGATE)!.damage = 3;
    find(g, 2, SECURITY)!.damage = 5;

    await g.playCardFromHandAsync(1, 0);

    expect(find(g, 1, SECURITY)!.damage).toBe(0);
    expect(find(g, 1, FRIGATE)!.damage).toBe(0);
    expect(find(g, 2, SECURITY)!.damage).toBe(5);
  });
});

describe("ASH_221 Helix Starfighter", () => {
  it("takes a Shield when the opponent controls a space unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, HELIX).WithSpaceUnitForPlayer(2, FRIGATE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(tokens(g, 1, HELIX, SHIELD)).toBe(1);
    expect(tokens(g, 1, HELIX, ADVANTAGE)).toBe(0);
  });

  it("takes 2 Advantage tokens otherwise", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, HELIX).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(tokens(g, 1, HELIX, ADVANTAGE)).toBe(2);
    expect(tokens(g, 1, HELIX, SHIELD)).toBe(0);
  });

  it("a FRIENDLY space unit does not satisfy the condition", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, HELIX).WithSpaceUnitForPlayer(1, FRIGATE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(tokens(g, 1, HELIX, ADVANTAGE)).toBe(2);
  });
});

describe("ASH_044 Barriss Offee — Redeeming Herself", () => {
  it("heals 2 and gives 2 Advantage tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, BARRISS).WithGroundUnitForPlayer(1, SECURITY).Build());
    find(g, 1, SECURITY)!.damage = 4;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, SECURITY)!.playId] });

    expect(find(g, 1, SECURITY)!.damage).toBe(2);
    expect(tokens(g, 1, SECURITY, ADVANTAGE)).toBe(2);
  });

  it("scales on damage ACTUALLY healed — 1 damage gives 1 token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, BARRISS).WithGroundUnitForPlayer(1, SECURITY).Build());
    find(g, 1, SECURITY)!.damage = 1;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, SECURITY)!.playId] });

    expect(find(g, 1, SECURITY)!.damage).toBe(0);
    expect(tokens(g, 1, SECURITY, ADVANTAGE)).toBe(1);
  });

  it("gives no token to an undamaged unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, BARRISS).WithGroundUnitForPlayer(1, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, SECURITY)!.playId] });

    expect(tokens(g, 1, SECURITY, ADVANTAGE)).toBe(0);
  });
});
