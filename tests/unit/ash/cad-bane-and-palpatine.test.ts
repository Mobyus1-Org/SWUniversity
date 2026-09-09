import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   ASH_011 Cad Bane — Still Faster than You
//     Front:    "Action [Exhaust]: Deal 1 damage to a unit with 2 or more remaining HP."
//     Deployed: "Overwhelm / On Attack: You may deal 1 damage to a unit with 2+ remaining HP."
//   ASH_015 Emperor Palpatine — According to My Design
//     Front:    "Action [Exhaust]: Choose an EXHAUSTED friendly unit. Give an Advantage token to
//                it for each OTHER friendly unit."
//     Deployed: "On Attack: You may choose ANOTHER exhausted friendly unit. If you do, give an
//                Advantage token to it for each other friendly unit."

const BANE = Cards.leaders.ash.cadBaneStillFaster;
const PALPATINE = Cards.leaders.ash.emperorPalpatineDesign;
const ADVANTAGE = Cards.upgrades.token.advantage;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7
const PORG = "LOF_254";                                 // 1/1 — only 1 remaining HP

function base(leader: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

const at = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId)!;
};
const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
};
const advantage = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  at(g, p, cardId).upgrades.filter(u => u.cardId === ADVANTAGE).length;

describe("ASH_011 Cad Bane — Still Faster than You (front)", () => {
  it("deals 1 to the chosen unit and exhausts the leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BANE).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: BANE });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, SECURITY).playId] });

    expect(at(g, 2, SECURITY).damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("cannot target a unit with only 1 remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(BANE).WithGroundUnitForPlayer(2, PORG).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: BANE });

    expect(offered(g)).not.toContain(at(g, 2, PORG).playId);
    expect(offered(g)).toContain(at(g, 2, SECURITY).playId);
  });

  it("measures REMAINING hp, so a damaged unit drops out of range", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BANE).WithGroundUnitForPlayer(2, MARINE).Build());
    at(g, 2, MARINE).damage = 2; // 3 HP - 2 = 1 remaining

    await g.dispatchAsync(1, "use-ability", { cardId: BANE });

    expect(offered(g)).not.toContain(at(g, 2, MARINE).playId);
  });

  it("can target a FRIENDLY unit — the text names no controller", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BANE).WithGroundUnitForPlayer(1, SECURITY).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: BANE });

    expect(offered(g)).toContain(at(g, 1, SECURITY).playId);
  });

  it("still exhausts with no legal target — the condition is not a cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BANE).WithGroundUnitForPlayer(2, PORG).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: BANE });

    expect(g.state.player1.leader.ready).toBe(false);
    expect(at(g, 2, PORG).damage).toBe(0);
  });
});

describe("ASH_015 Emperor Palpatine — According to My Design (front)", () => {
  it("gives one Advantage token per OTHER friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(PALPATINE)
        .WithGroundUnitForPlayer(1, SECURITY, false) // exhausted — the only legal target
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: PALPATINE });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, SECURITY).playId] });

    expect(advantage(g, 1, SECURITY)).toBe(2); // two other friendly units
  });

  it("gives nothing when the chosen unit is your only one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(PALPATINE).WithGroundUnitForPlayer(1, SECURITY, false).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: PALPATINE });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, SECURITY).playId] });

    expect(advantage(g, 1, SECURITY)).toBe(0);
  });

  it("offers only EXHAUSTED friendly units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(PALPATINE)
        .WithGroundUnitForPlayer(1, SECURITY, false) // exhausted
        .WithGroundUnitForPlayer(1, MARINE, true)    // ready
        .WithGroundUnitForPlayer(2, SECURITY, false) // enemy, exhausted
        .Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: PALPATINE });

    expect(offered(g)).toEqual([at(g, 1, SECURITY).playId]);
  });

  it("still exhausts with no exhausted friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(PALPATINE).WithGroundUnitForPlayer(1, MARINE, true).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: PALPATINE });

    expect(g.state.player1.leader.ready).toBe(false);
    expect(advantage(g, 1, MARINE)).toBe(0);
  });
});

describe("deployed sides", () => {
  /** Deploys the leader and hands the turn back so they can attack next. */
  async function deployed(g: GameTestAdapter): Promise<void> {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }

  it("ASH_011 Cad Bane gains Overwhelm once deployed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BANE).WithGroundUnitForPlayer(2, PORG).Build());
    await deployed(g);

    // 4 power into a 1/1 leaves 3 excess, which Overwhelm spills onto the base.
    const baneIdx = g.state.player1.groundArena.findIndex(u => u.cardId === BANE);
    await g.attackWithGroundUnitAsync(1, baneIdx);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, PORG).playId] });
    // His On Attack fires too; decline it so only combat is measured.
    if (g.lastDispatchResponse?.resolutionNeeded?.type === "Option") await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("ASH_011 Cad Bane's deployed On Attack is optional and deals 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BANE).WithGroundUnitForPlayer(2, SECURITY).Build());
    await deployed(g);

    const baneIdx = g.state.player1.groundArena.findIndex(u => u.cardId === BANE);
    await g.attackWithGroundUnitAsync(1, baneIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, SECURITY).playId] });

    expect(at(g, 2, SECURITY).damage).toBe(1);
  });

  it("ASH_015 Palpatine's deployed On Attack buffs ANOTHER exhausted unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(PALPATINE)
        .WithGroundUnitForPlayer(1, SECURITY, false) // exhausted
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );
    await deployed(g);

    const palpIdx = g.state.player1.groundArena.findIndex(u => u.cardId === PALPATINE);
    await g.attackWithGroundUnitAsync(1, palpIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, SECURITY).playId] });

    // Other friendly units at that moment: the Marine and Palpatine himself = 2.
    expect(advantage(g, 1, SECURITY)).toBe(2);
  });

  it("ASH_015 Palpatine cannot pick HIMSELF, though attacking left him exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(PALPATINE).WithGroundUnitForPlayer(1, SECURITY, false).Build());
    await deployed(g);

    const palpIdx = g.state.player1.groundArena.findIndex(u => u.cardId === PALPATINE);
    await g.attackWithGroundUnitAsync(1, palpIdx);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(offered(g)).toEqual([at(g, 1, SECURITY).playId]);
  });
});
