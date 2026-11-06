import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_013 Luthen Rael — Don't You Want to Fight For Real? (Leader, Aggression/Heroism; unit 2/7 Ground)
//   Front: "When a friendly unit is defeated while attacking: You may exhaust this leader. If you do,
//           deal 1 damage to a unit or base.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "When a friendly unit is defeated while attacking: You may deal 2 damage to a unit or base."
// A deployed Luthen sees his own defeat while attacking.

const LUTHEN = Cards.leaders.sec.luthenRael;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const WAMPA = Cards.units.sor.wampa;              // 4/5
const TURTLE = Cards.units.ash.dinosaurTurtle;    // 7/7

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(LUTHEN)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;

async function marineDiesAttacking(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === MARINE));
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
}

describe("SEC_013 Luthen Rael — leader side", () => {
  it("a friendly attacker dies: may exhaust Luthen to deal 1 damage to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());

    await marineDiesAttacking(g);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(4); // 3 combat + 1
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("…or to a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());

    await marineDiesAttacking(g);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("declining keeps Luthen ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());

    await marineDiesAttacking(g);
    await g.chooseNoAsync(1);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("Heroic Sacrifice on a base attack counts as defeated while attacking", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, Cards.events.sor.heroicSacrifice)
      .WithCardInDeckForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(6); // 5 combat + 1
  });

  it("not when the defender dies, nor when an exhausted Luthen can't pay", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TURTLE).WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(res(g)).toBeFalsy(); // the defender died, not the attacker

    g.state.player1.leader.ready = false;
    await g.dispatchAsync(2, "pass-action", {});
    await marineDiesAttacking(g);
    expect(res(g)).toBeFalsy();
  });
});

describe("SEC_013 Luthen Rael — deployed", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }

  it("another friendly attacker dies: may deal 2 damage, no exhaust needed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());
    await deployed(g);

    await marineDiesAttacking(g);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0); // 3 + 2 = 5
  });

  it("Luthen himself defeated while attacking sees it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, TURTLE).Build());
    await deployed(g);
    const luthen = g.state.player1.groundArena.find(u => u.cardId === LUTHEN)!;
    luthen.damage = 1; // 6 left; the turtle hits for 7

    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.indexOf(luthen));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
  });
});
