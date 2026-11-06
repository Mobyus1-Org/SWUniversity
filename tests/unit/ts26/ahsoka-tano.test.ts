import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// TS26_08 Ahsoka Tano — I Have an Idea (Leader, Cunning/Heroism; unit side 3/6 Ground)
//   Front: "When you play an event: You may exhaust this leader. If you do, look at the top card of
//           your deck. You may play it (paying its cost), discard it, or leave it on top of your deck.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "Raid 1. When Attack Ends: Look at the top card of your deck. You may play it, discard
//           it, or leave it on top of your deck. If you play it, it costs 1 resource less."
// The deployed ability has no "if this unit survived", so it resolves even if she was defeated.

const AHSOKA = Cards.leaders.ts26.ahsokaTano;
const MARINE = Cards.units.sor.battlefieldMarine; // cost 2, Command/Heroism
const RAID = Cards.events.shd.daringRaid;         // Deal 2 damage to a unit or base
const TURTLE = Cards.units.ash.dinosaurTurtle;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(AHSOKA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8)
    .WithCardInDeckForPlayer(1, TURTLE)
    .WithCardInDeckForPlayer(1, MARINE); // the top card
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const options = (g: GameTestAdapter) => { const r = res(g); return r?.type === "Option" ? r.options ?? [] : []; };
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

async function playRaid(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
}

describe("TS26_08 Ahsoka Tano — leader side", () => {
  it("after an event: may exhaust, then play the top card paying its cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, RAID).Build());

    await playRaid(g);
    expect(g.state.player2.base.damage).toBe(2); // the event resolved first
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(options(g)).toEqual(["play", "discard", "leave"]);
    const before = readyResources(g);
    await g.chooseOptionAsync(1, "play");

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(readyResources(g)).toBe(before - 2);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("…or discard it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, RAID).Build());

    await playRaid(g);
    await g.chooseYesAsync(1);
    await g.chooseOptionAsync(1, "discard");

    expect(g.state.player1.discard.map(c => c.cardId)).toContain(MARINE);
    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([TURTLE]);
  });

  it("…or leave it on top", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, RAID).Build());

    await playRaid(g);
    await g.chooseYesAsync(1);
    await g.chooseOptionAsync(1, "leave");

    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([TURTLE, MARINE]);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("declining keeps her ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, RAID).Build());

    await playRaid(g);
    await g.chooseNoAsync(1);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player1.deck).toHaveLength(2);
  });

  it("not for a unit, nor for the opponent's event", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, MARINE)
      .WithCardInHandForPlayer(2, RAID).FillResourcesForPlayer(2, MARINE, 8).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(res(g)).toBeFalsy();
    await g.playCardFromHandAsync(2, 0);
    await g.chooseBaseAsync(2, 1);
    expect(res(g)).toBeFalsy();
  });

  it("an unaffordable top card can only be discarded or left", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, RAID).Build());
    g.state.player1.resources.forEach((r, i) => { r.ready = i < 3; }); // 3 ready: Raid costs 1 + 2

    await playRaid(g);
    await g.chooseYesAsync(1);

    expect(options(g)).toEqual(["discard", "leave"]);
  });
});

describe("TS26_08 Ahsoka Tano — deployed When Attack Ends", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const ahsokaIndex = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === AHSOKA);

  it("Raid 1; then the top card may be played for 1 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);
    expect(RaidAmount(AHSOKA, g.state.player1.groundArena[ahsokaIndex(g)].playId, 1)).toBe(1);

    await g.attackWithGroundUnitAsync(1, ahsokaIndex(g));
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(4);
    const before = readyResources(g);
    await g.chooseOptionAsync(1, "play");

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(MARINE);
    expect(readyResources(g)).toBe(before - 1);
  });

  it("still resolves when she was defeated in the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, TURTLE).Build());
    await deployed(g);
    g.state.player1.groundArena[ahsokaIndex(g)].damage = 1;

    await g.attackWithGroundUnitAsync(1, ahsokaIndex(g));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player1.groundArena.map(u => u.cardId)).not.toContain(AHSOKA);
    expect(res(g)?.type).toBe("Option");
    await g.chooseOptionAsync(1, "discard");

    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([TURTLE]);
  });

  it("the leader-side event trigger is gone once she is deployed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, RAID).Build());
    await deployed(g);

    await playRaid(g);

    expect(res(g)).toBeFalsy();
  });
});
