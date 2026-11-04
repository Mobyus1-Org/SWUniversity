import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// IC27_001 Darth Vader — No One to Stop Us (Leader, Vigilance/Villainy; unit side 5/7 Ground)
//   Front: "Action [1 resource, Exhaust, defeat a friendly unit]: Draw a card and heal 2 damage
//           from your base. Epic Action: If you control 7 or more resources, deploy this leader."
//   Unit:  "On Attack: You may defeat another friendly unit. If you do, draw a card and heal 2
//           damage from your base."

const VADER = Cards.leaders.ic27.darthVader;
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function board(resources = 14) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(VADER)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInDeckForPlayer(1, SECURITY);
}

describe("IC27_001 Darth Vader — leader Action", () => {
  it("pays 1 and defeats a friendly unit, then draws a card and heals 2 from your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    g.state.player1.base.damage = 5;
    const before = readyResources(g);

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(MARINE);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([SECURITY]);
    expect(g.state.player1.base.damage).toBe(3);
    expect(before - readyResources(g)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("is not available without a friendly unit to defeat", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    expect(ActionAbilities(VADER, 1)).not.toContain(VADER);
  });

  it("Epic Action needs 7 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBeFalsy();
  });
});

describe("IC27_001 Darth Vader — deployed On Attack", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    expect(g.state.player1.leader.deployed).toBe(true);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const vaderIndex = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === VADER);

  it("may defeat another friendly unit; if so, draw and heal 2, then the attack lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    g.state.player1.base.damage = 5;
    await deployed(g);
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!.playId;

    await g.attackWithGroundUnitAsync(1, vaderIndex(g));
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type === "Target" ? res.fromPlayIds : []).toEqual([marine]); // not Vader himself
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([VADER]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([SECURITY]);
    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("declining defeats nothing and gives nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    g.state.player1.base.damage = 5;
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, vaderIndex(g));
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(2);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("control: with no other friendly unit there is no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, vaderIndex(g));
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(5);
  });
});
