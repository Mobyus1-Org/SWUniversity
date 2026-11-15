import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import type { NeedsDeckSearch } from "@/lib/engine/message-types";

// SHD Bounties that were never collected:
//   SHD_058 Val — "Bounty — Deal 3 damage to a unit." / "When Defeated: Give 2 Experience tokens to a friendly unit."
//   SHD_071 Top Target — "Bounty — Heal 4 damage from a unit or base. If this unit is unique, heal 6 instead."
//   SHD_123 Bounty Hunter's Quarry — "Bounty — Search the top 5 (10 if unique) for a unit that costs 3 or less and play it for free."
//   SHD_125 Price on Your Head — "Bounty — Put the top card of your deck into play as a resource."
//   SHD_161 Stolen Landspeeder — "When Played: If you played this unit from your hand, an opponent
//           takes control of it." / "Bounty — If you own this unit, play it from your discard pile for free and give an Experience token to it."
//   SHD_165 Unlicensed Headhunter — while exhausted: "Bounty — Heal 5 damage from your base."
//   SHD_176 Death Mark — "Bounty — Draw 2 cards."
//   SHD_222 Enticing Reward — "Bounty — Search the top 10 for 2 non-unit cards, draw them. Then, if this unit isn't unique, discard a card from your hand."
//   SHD_261 Rich Reward — "Bounty — Give an Experience token to each of up to 2 units."
//
// In every case P1's 3/7 attacks and defeats P2's unit, and P1 (the opponent) collects.

const CSF = Cards.units.sor.consularSecurityForce; // 3/7
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3, non-unique
const KUIIL = Cards.units.shd.kuiil;                // 2/3, unique
const XP = Cards.upgrades.token.experience;
const EVENT = Cards.events.hmw.migrate;
const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });
const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 10)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP, 10)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, CSF)
    .WithActivePlayer(1);
}

async function defeatAndCollect(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
  expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  await g.chooseYesAsync(1);
}

function load(state: ReturnType<GameStateBuilder["Build"]>) {
  const g = new GameTestAdapter();
  g.loadNewState(state);
  return g;
}

describe("SHD_058 Val", () => {
  it("Bounty: the collector deals 3 damage to a unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, Cards.units.shd.val, true, 1).WithGroundUnitForPlayer(2, CSF).Build());
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    // Val's own When Defeated (P2's) and the Bounty (P1's) both trigger; P1 is active and resolves first.
    if (g.lastDispatchResponse?.resolutionNeeded?.type === "Option") await g.chooseYesAsync(1);
    const enemyCsf = g.state.player2.groundArena.find(u => u.cardId === CSF)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyCsf.playId] });
    expect(g.state.player2.groundArena.find(u => u.cardId === CSF)!.damage).toBe(3);
  });

  it("When Defeated: 2 Experience tokens to a friendly unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, Cards.units.shd.val, true, 1).WithGroundUnitForPlayer(2, CSF).Build());
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    if (g.lastDispatchResponse?.resolutionNeeded?.type === "Option") await g.chooseNoAsync(1); // skip the Bounty
    const friend = g.state.player2.groundArena.find(u => u.cardId === CSF)!;
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [friend.playId] });
    expect(xp(g.state.player2.groundArena.find(u => u.cardId === CSF)!)).toBe(2);
  });
});

describe("SHD_071 Top Target", () => {
  it("heals 4 from a base for a non-unique unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.topTarget, 1)]).Build());
    await defeatAndCollect(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });
    expect(g.state.player1.base.damage).toBe(6);
  });

  it("heals 6 for a unique unit, and can heal a unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF, true, 6).WithGroundUnitForPlayer(2, KUIIL).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.topTarget, 1)]).Build());
    await defeatAndCollect(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });
    expect(g.state.player1.groundArena[1].damage).toBe(0);
  });
});

describe("SHD_123 Bounty Hunter's Quarry", () => {
  it("plays a unit costing 3 or less from the top 5 for free", async () => {
    const state = board().WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.bountyHuntersQuarry, 1)])
      .WithCardInDeckForPlayer(1, CSF).WithCardInDeckForPlayer(1, MARINE).Build();
    const g = load(state);
    await defeatAndCollect(g);
    const search = g.lastDispatchResponse?.resolutionNeeded as NeedsDeckSearch;
    expect(search.choices.map(c => c.cardId)).toEqual([MARINE]); // the 4-cost CSF isn't offered
    await g.chooseDeckSearchAsync(1, [search.choices[0].tempId]);
    expect(g.state.player1.groundArena.filter(u => u.cardId === MARINE).length).toBe(1);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(0);
  });
});

describe("SHD_125 Price on Your Head", () => {
  it("the collector's top card becomes a resource", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.priceOnYourHead, 1)]).WithCardInDeckForPlayer(1, KUIIL).Build());
    await defeatAndCollect(g);
    expect(g.state.player1.resources.map(r => r.cardId)).toEqual([KUIIL]);
  });
});

describe("SHD_161 Stolen Landspeeder", () => {
  it("played from hand, the opponent takes control of it", async () => {
    const g = load(board().FillResourcesForPlayer(1, MARINE, 5).WithCardInHandForPlayer(1, Cards.units.shd.stolenLandspeeder).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.shd.stolenLandspeeder)).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.shd.stolenLandspeeder)).toBe(false);
  });

  it("its owner collects the Bounty: replays it free from the discard with an Experience token", async () => {
    // P1 owns it, P2 controls it; P1's 3/7 defeats it.
    const state = board().WithGroundUnitForPlayer(2, Cards.units.shd.stolenLandspeeder).Build();
    state.player2.groundArena[0].owner = 1;
    const g = load(state);
    await defeatAndCollect(g);
    const back = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.stolenLandspeeder)!;
    expect(back).toBeDefined();
    expect(xp(back)).toBe(1);
  });

  it("a collector who doesn't own it gets nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, Cards.units.shd.stolenLandspeeder).Build());
    await defeatAndCollect(g);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.shd.stolenLandspeeder)).toBe(false);
  });
});

describe("SHD_165 Unlicensed Headhunter", () => {
  it("defeated while exhausted: the collector heals 5 from their own base", async () => {
    const state = board().WithSpaceUnitForPlayer(1, Cards.units.token.xWing).WithSpaceUnitForPlayer(2, Cards.units.shd.unlicensedHeadhunter, false, 1).Build();
    const g = load(state);
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });
    await g.chooseYesAsync(1);
    expect(g.state.player1.base.damage).toBe(5);
  });
});

describe("SHD_176 Death Mark", () => {
  it("the collector draws 2", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.deathMark, 1)]).WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE).Build());
    await defeatAndCollect(g);
    expect(g.state.player1.hand.length).toBe(2);
  });
});

describe("SHD_222 Enticing Reward", () => {
  it("draws up to 2 non-unit cards, then a non-unique unit's bounty discards one", async () => {
    const state = board().WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.enticingReward, 1)])
      .WithCardInDeckForPlayer(1, EVENT).WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, EVENT).Build();
    const g = load(state);
    await defeatAndCollect(g);
    const search = g.lastDispatchResponse?.resolutionNeeded as NeedsDeckSearch;
    expect(search.choices.every(c => c.cardId === EVENT)).toBe(true);
    await g.chooseDeckSearchAsync(1, search.choices.map(c => c.tempId));
    expect(g.state.player1.hand.length).toBe(2);
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.hand.length).toBe(1);
  });
});

describe("SHD_261 Rich Reward", () => {
  it("an Experience token on each of up to 2 units", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [up(Cards.upgrades.shd.richReward, 1)]).Build());
    await defeatAndCollect(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: g.state.player1.groundArena.map(u => u.playId) });
    expect(g.state.player1.groundArena.map(xp)).toEqual([1, 1]);
  });
});
