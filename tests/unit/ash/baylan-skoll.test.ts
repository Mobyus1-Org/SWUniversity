import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// ASH_003 Baylan Skoll — Power Beyond Dream (Leader, Vigilance/Villainy; deployed 4/6 Ground)
//   Front: "Action [1 resource, Exhaust]: Give a friendly unit +2/+2 for this phase if it's the
//           only unit you control in its arena."
//   Deployed: "On Attack: You may give a friendly unit +2/+2 and Sentinel for this phase if it's
//              the only non-leader unit you control in its arena."
//
// The "if" narrows the choice to qualifying units. On the front, with none, the Action is still
// paid for and simply does nothing.

const BAYLAN = Cards.leaders.ash.baylanSkoll;
const WAMPA = Cards.units.sor.wampa;           // 4/5 Ground
const MARINE = Cards.units.sor.battlefieldMarine;
const TIE = Cards.units.sor.tieLnFighter;      // 2/1 Space
const DURABLE = Cards.units.sor.consularSecurityForce;

function base(resources = 6) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(BAYLAN)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

const stats = (u: Parameters<typeof Unit.FromInterface>[0]) => {
  const x = Unit.FromInterface(u);
  return { power: x.CurrentPower(), hp: x.TotalHP() };
};
const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];
const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("ASH_003 Baylan Skoll — leader Action", () => {
  it("gives a unit that's alone in its arena +2/+2 for the phase, for 1 resource and exhausting", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, WAMPA).WithSpaceUnitForPlayer(1, TIE).Build());

    await g.useLeaderAbilityAsync(1);
    expect([...offer(g)].sort()).toEqual([g.state.player1.groundArena[0].playId, g.state.player1.spaceArena[0].playId].sort());
    await g.chooseGroundUnitAsync(1, 0);

    expect(stats(g.state.player1.groundArena[0])).toEqual({ power: 6, hp: 7 });
    expect(ready(g)).toBe(5);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("a unit sharing its arena with another friendly unit isn't offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, TIE).Build());

    await g.useLeaderAbilityAsync(1);

    expect(offer(g)).toEqual([g.state.player1.spaceArena[0].playId]);
  });

  it("enemy units don't count against 'only unit you control'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(2, DURABLE).Build());

    await g.useLeaderAbilityAsync(1);

    expect(offer(g)).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("no unit alone in its arena — still paid and exhausted, nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(ready(g)).toBe(5);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("can't be used without a ready resource to pay", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(0).WithGroundUnitForPlayer(1, WAMPA).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("ASH_003 Baylan Skoll — deployed On Attack", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const baylanIdx = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === BAYLAN);

  it("the only non-leader unit in its arena gets +2/+2 and Sentinel — Baylan himself doesn't count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(2, DURABLE).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, baylanIdx(g));
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    const wampa = g.state.player1.groundArena.find(u => u.cardId === WAMPA)!;
    expect(offer(g)).toEqual([wampa.playId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa.playId] });

    expect(stats(g.state.player1.groundArena.find(u => u.cardId === WAMPA)!)).toEqual({ power: 6, hp: 7 });

    // Sentinel: the enemy's attack must now go at the Wampa.
    await g.attackWithGroundUnitAsync(2, 0);
    expect(offer(g)).toEqual([wampa.playId]);
  });

  it("Baylan alone in the ground — only the lone space unit is offered, never Baylan", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, TIE).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, baylanIdx(g));
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(offer(g)).toEqual([g.state.player1.spaceArena[0].playId]);
  });

  it("no qualifying unit — no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(1, MARINE).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, baylanIdx(g));
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("declining gives nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, WAMPA).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, baylanIdx(g));
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(stats(g.state.player1.groundArena.find(u => u.cardId === WAMPA)!)).toEqual({ power: 4, hp: 5 });
  });
});
