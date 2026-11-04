import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// IC27_007 Asajj Ventress — Bald and Beautiful (Leader, Cunning/Villainy; unit side 5/6 Ground)
//   Front: "Action [Exhaust]: Attack with a unit. After completing this attack, if the attacker
//           survived, you may ready a resource. Epic Action: If you control 6 or more resources,
//           deploy this leader."
//   Unit:  "Saboteur. On Attack: You may ready a resource."
// A "may" with nothing exhausted to ready is not offered (same as Coruscant Dissident).

const ASAJJ = Cards.leaders.ic27.asajjVentress;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const WAMPA = Cards.units.sor.wampa;              // 4/5

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function board(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(ASAJJ)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

function exhaustResources(g: GameTestAdapter, n: number) {
  for (const r of g.state.player1.resources.slice(0, n)) r.ready = false;
}

describe("IC27_007 Asajj Ventress — leader Action", () => {
  it("attacks with a unit; after it survives, may ready a resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    exhaustResources(g, 2);

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(readyResources(g)).toBe(7); // exactly one readied
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("declining readies nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    exhaustResources(g, 2);

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(readyResources(g)).toBe(6);
  });

  it("an attacker that dies in the attack gets no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());
    exhaustResources(g, 2);

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(readyResources(g)).toBe(6);
  });

  it("control: an ordinary attack afterwards does not re-offer it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, MARINE).Build());
    exhaustResources(g, 3);

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(readyResources(g)).toBe(6);
  });
});

describe("IC27_007 Asajj Ventress — deployed", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    expect(g.state.player1.leader.deployed).toBe(true);
    await g.dispatchAsync(2, "pass-action", {});
  }

  it("has Saboteur", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);

    expect(HasSaboteur(ASAJJ, g.state.player1.groundArena[0].playId, 1)).toBe(true);
  });

  it("On Attack: may ready a resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);
    exhaustResources(g, 2);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(readyResources(g)).toBe(7);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("On Attack: declining readies nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);
    exhaustResources(g, 2);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(readyResources(g)).toBe(6);
  });

  it("Epic Action needs 6 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBeFalsy();
  });
});
