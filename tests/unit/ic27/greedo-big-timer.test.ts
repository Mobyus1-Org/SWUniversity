import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// IC27_142 Greedo — Big-Timer (5/3 Ground, cost 3, Cunning/Villainy)
//   "Ambush. While attacking or defending, this unit deals combat damage after the other attacking
//    or defending unit."  A unit defeated before its turn deals nothing.

const GREEDO = Cards.units.ic27.greedo;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 — kills Greedo
const THUG = Cards.units.shd.underworldThug;      // 2/3 — doesn't

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

async function attackUnit(g: GameTestAdapter, attacker: 1 | 2) {
  const defender = attacker === 1 ? 2 : 1;
  await g.attackWithGroundUnitAsync(attacker, 0);
  const target = (defender === 1 ? g.state.player1 : g.state.player2).groundArena[0].playId;
  await g.dispatchAsync(attacker, "choose-target", { targetPlayIds: [target] });
}

describe("IC27_142 Greedo — attacking", () => {
  it("has Ambush", () => {
    expect(HasAmbush(GREEDO)).toBe(true);
  });

  it("the defender strikes first: Greedo dies and deals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, GREEDO).WithGroundUnitForPlayer(2, MARINE).Build());

    await attackUnit(g, 1);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("if he survives the first hit, he then deals his damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, GREEDO).WithGroundUnitForPlayer(2, THUG).Build());

    await attackUnit(g, 1);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("a defender's Shield survives when Greedo dies first", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, GREEDO).WithGroundUnitForPlayer(2, MARINE).Build();
    state.player2.groundArena[0].upgrades = [{ cardId: Cards.upgrades.token.shield, playId: "sh", owner: 2, controller: 2 }];
    g.loadNewState(state);

    await attackUnit(g, 1);

    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
  });

  it("attacking a base is unaffected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, GREEDO).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);
  });
});

describe("IC27_142 Greedo — defending", () => {
  it("the attacker strikes first: Greedo dies and deals no counter-damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, GREEDO).WithGroundUnitForPlayer(2, MARINE).WithActivePlayer(2).Build());

    await attackUnit(g, 2);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("if he survives, he counters for 5", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, GREEDO).WithGroundUnitForPlayer(2, THUG).WithActivePlayer(2).Build());

    await attackUnit(g, 2);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});

describe("IC27_142 Greedo — conflicts", () => {
  it("Greedo against Greedo cancels out: simultaneous, both die", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, GREEDO).WithGroundUnitForPlayer(2, GREEDO).Build());

    await attackUnit(g, 1);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("an attacking Greedo with Shoot First deals first (the controller's better choice)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .FillResourcesForPlayer(1, MARINE, 5)
      .WithCardInHandForPlayer(1, Cards.events.ic27.shootFirst)
      .WithGroundUnitForPlayer(1, GREEDO).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("a blanked Greedo deals damage normally — simultaneous trade", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, GREEDO).WithGroundUnitForPlayer(2, MARINE).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning, duration: "Phase", affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);

    await attackUnit(g, 1);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});
