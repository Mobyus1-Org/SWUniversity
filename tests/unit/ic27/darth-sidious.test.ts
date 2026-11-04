import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_026 Darth Sidious — Move Against the Jedi (5/8 Ground, cost 7, Vigilance/Villainy)
//   "Restore 3. When you heal damage from your base: Deal that much damage to an enemy unit."
// "That much" is what was actually healed — a heal capped by the base's damage deals the capped
// amount, and a heal of 0 is no heal at all. Mandatory, any enemy unit. Every base heal counts,
// not just Sidious's own Restore.

const SIDIOUS = Cards.units.ic27.darthSidious;
const LUKE = Cards.units.ibh.lukeSkywalker;   // Restore 2
const WAMPA = Cards.units.sor.wampa;          // 4/5
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7
const TRI_FIGHTER = Cards.units.twi.confederateTriFighter; // "Bases can't be healed."

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, SIDIOUS);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? res.fromPlayIds : undefined;
};

describe("IC27_026 Darth Sidious — Move Against the Jedi", () => {
  it("Restore 3 heals your base, and he deals that much damage to an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SECURITY).Build());
    g.state.player1.base.damage = 5;
    const security = g.state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(offered(g)).toEqual([security]); // mandatory — no yes/no
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [security] });

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(g.state.player2.base.damage).toBe(5); // the attack still landed
  });

  it("deals what was actually healed, not the Restore value", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SECURITY).Build());
    g.state.player1.base.damage = 2; // Restore 3 can only heal 2

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("control: an undamaged base heals nothing, so nothing triggers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("another friendly unit's Restore triggers him too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, LUKE).WithGroundUnitForPlayer(2, SECURITY).Build());
    g.state.player1.base.damage = 5;

    await g.attackWithGroundUnitAsync(1, 1); // Luke, Restore 2
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("resolves BEFORE combat damage: killing the defender means Sidious takes no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());
    g.state.player1.base.damage = 5;
    const marine = g.state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] }); // attack the 3/3
    expect(offered(g)).toEqual([marine]); // asked before any combat damage
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(0); // no defender left to strike back
  });

  it("when the defender survives his damage, the attack continues into combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).Build());
    g.state.player1.base.damage = 5;
    const wampa = g.state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa] }); // 3 now, then 5 in combat

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(4); // the Wampa struck back
  });

  it("the damage can defeat the enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());
    g.state.player1.base.damage = 5;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0); // 3/3 takes 3
  });

  it("control: the OPPONENT healing their base does not trigger your Sidious", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, LUKE).WithActivePlayer(2).Build());
    g.state.player2.base.damage = 5;

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player2.base.damage).toBe(3); // their Restore healed
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("control: with no enemy unit there is nothing to damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    g.state.player1.base.damage = 5;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("control: while bases can't be healed, nothing is healed and nothing triggers", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).WithSpaceUnitForPlayer(2, TRI_FIGHTER).Build());
    g.state.player1.base.damage = 5;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(5);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
