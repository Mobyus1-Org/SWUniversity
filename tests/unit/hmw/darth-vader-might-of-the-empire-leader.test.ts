import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_007 Darth Vader — Might of the Empire (Leader, Command/Villainy, cost 6; 5/5 Ground unit)
//   Front:    "Friendly units that cost 3 or more gain Raid 1.
//              Epic Action: If you control 6 or more resources, deploy this leader."
//   Deployed: "Raid 1. Other friendly units that cost 3 or more gain Raid 1."
//
// Raid adds up: a unit with printed Raid 1 gets Raid 2 under Vader. Deployed, "OTHER" matters — he
// costs 6, so without it he'd grant himself a second Raid and attack for 7 instead of 6.

const VADER = Cards.leaders.hmw.darthVaderMightOfTheEmpire;
const DROID = Cards.units.twi.superBattleDroid;      // 4/3, cost 3, no text
const MARINE = Cards.units.sor.battlefieldMarine;    // 3/3, cost 2
const SOLDIER = Cards.units.sor.volunteerSoldier;    // 2/3, cost 3, printed Raid 1
const TOKEN = Cards.units.token.battleDroid;         // 1/1 token, cost 0
const WAYFARER = Cards.units.lof.hyperspaceWayfarer; // 4/10 Space, cost 6

function base(resources = 10) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(VADER)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

async function attackBaseWithGround(g: GameTestAdapter, player: 1 | 2, index: number) {
  await g.attackWithGroundUnitAsync(player, index);
  await g.chooseBaseAsync(player, player === 1 ? 2 : 1);
}

describe("HMW_007 Darth Vader — front: friendly units that cost 3 or more gain Raid 1", () => {
  it("a cost-3 unit attacks for +1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, DROID).Build());
    await attackBaseWithGround(g, 1, 0);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("a cost-2 unit doesn't", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, MARINE).Build());
    await attackBaseWithGround(g, 1, 0);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("a token unit (cost 0) doesn't", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, TOKEN).Build());
    await attackBaseWithGround(g, 1, 0);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("stacks on a printed Raid: Raid 1 + Raid 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, SOLDIER).Build());
    await attackBaseWithGround(g, 1, 0);
    expect(g.state.player2.base.damage).toBe(4); // 2 + 1 + 1
  });

  it("applies in space too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, WAYFARER).Build());
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("not the opponent's units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithActivePlayer(2).WithGroundUnitForPlayer(2, DROID).Build());
    await attackBaseWithGround(g, 2, 0);
    expect(g.state.player1.base.damage).toBe(4);
  });

  it("follows the controller: a unit you took control of gains it; yours under their control doesn't", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, DROID)          // owned by P2, controlled by P1
      .WithGroundUnitForPlayer(2, DROID)          // owned by P1, controlled by P2
      .Build();
    s.player1.groundArena[0].owner = 2;
    s.player2.groundArena[0].owner = 1;
    g.loadNewState(s);

    await attackBaseWithGround(g, 1, 0);
    expect(g.state.player2.base.damage).toBe(5);
    await attackBaseWithGround(g, 2, 0);
    expect(g.state.player1.base.damage).toBe(4);
  });

  it("not while leaders lose their abilities (Brain Invaders)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, DROID)
      .WithGroundUnitForPlayer(2, Cards.units.twi.brainInvaders)
      .Build());
    await attackBaseWithGround(g, 1, 0);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("deploys with 6 resources, not 5", async () => {
    const five = new GameTestAdapter();
    five.loadNewState(base(5).Build());
    await five.deployLeaderAsync(1);
    expect(five.state.player1.leader.deployed).toBe(false);

    const six = new GameTestAdapter();
    six.loadNewState(base(6).Build());
    await six.deployLeaderAsync(1);
    expect(six.state.player1.leader.deployed).toBe(true);
    expect(six.state.player1.groundArena.some(u => u.cardId === VADER)).toBe(true);
  });
});

describe("HMW_007 Darth Vader — deployed", () => {
  function deployed() {
    return base().MyLeader(VADER, true, true).WithGroundUnitForPlayer(1, VADER);
  }

  it("Vader himself has Raid 1 — not 2: 'other' keeps his own aura off him", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());
    await attackBaseWithGround(g, 1, 0);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("other friendly units that cost 3 or more still gain Raid 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(1, DROID).Build());
    await attackBaseWithGround(g, 1, 1);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("cost-2 units still don't", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(1, MARINE).Build());
    await attackBaseWithGround(g, 1, 1);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("once deployed Vader is defeated, the front's aura is back", async () => {
    const g = new GameTestAdapter();
    const s = deployed()
      .WithActivePlayer(2)
      .WithGroundUnitForPlayer(1, DROID)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build();
    s.player1.groundArena[0].damage = 4; // Vader on 1 HP left
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0); // the Marine kills Vader
    expect(g.state.player1.leader.deployed).toBe(false);

    await attackBaseWithGround(g, 1, 0);  // the droid, now at index 0
    expect(g.state.player2.base.damage).toBe(5);
  });
});
