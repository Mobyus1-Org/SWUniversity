import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_002 Jabba the Hutt — Wonderful Human Being (Leader, Vigilance/Villainy; unit side 2/8 Ground)
//   Front: "Action [1 resource, Exhaust]: A friendly damaged unit deals 1 damage to an enemy unit.
//           If the friendly unit has 3 or more damage on it, it deals 2 damage instead.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "When another friendly unit is dealt damage and survives: You may have that unit deal
//           that much damage to an enemy unit. Use this ability only once each round."

const JABBA = Cards.leaders.sec.jabbaTheHutt;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const TURTLE = Cards.units.ash.dinosaurTurtle;    // 7/7
const WAMPA = Cards.units.sor.wampa;              // 4/5

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(JABBA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const targets = (g: GameTestAdapter) => { const r = res(g); return r?.type === "Target" ? r.fromPlayIds ?? [] : []; };
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("SEC_002 Jabba the Hutt — leader Action", () => {
  it("a friendly damaged unit deals 1 damage to an enemy unit; costs 1 resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TURTLE, true, 2).WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, WAMPA).Build());
    const turtle = g.state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    expect(targets(g)).toEqual([turtle]); // only the damaged one
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [turtle] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(readyResources(g)).toBe(7);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("with 3 or more damage on it, the friendly unit deals 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TURTLE, true, 3).WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("with no damaged friendly unit, it is paid for and does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TURTLE).WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.useLeaderAbilityAsync(1);

    expect(res(g)).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});

describe("SEC_002 Jabba the Hutt — deployed", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const unitIndex = (g: GameTestAdapter, cardId: string) => g.state.player1.groundArena.findIndex(u => u.cardId === cardId);

  it("another friendly unit survives combat damage: it may deal that much to an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TURTLE).WithGroundUnitForPlayer(2, WAMPA).WithGroundUnitForPlayer(2, MARINE).Build());
    await deployed(g);
    const wampa = g.state.player2.groundArena[0].playId;
    const marine = g.state.player2.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, unitIndex(g, TURTLE));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa] }); // turtle takes 4, survives
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([]); // wampa to combat, marine to 4
  });

  it("can be declined, and only once each round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TURTLE).WithGroundUnitForPlayer(1, TURTLE)
      .WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, TURTLE).Build());
    await deployed(g);
    const [m1, m2] = g.state.player2.groundArena.map(u => u.playId);

    await g.attackWithGroundUnitAsync(1, unitIndex(g, TURTLE));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [m1] });
    await g.chooseNoAsync(1); // declined: not used
    await g.dispatchAsync(2, "pass-action", {});
    const second = g.state.player1.groundArena.findIndex(u => u.cardId === TURTLE && u.ready);
    await g.attackWithGroundUnitAsync(1, second);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [m2] });
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player2.groundArena[0].damage).toBe(3);

    // A third hit this round: the ability is spent.
    await g.dispatchAsync(2, "pass-action", {});
    g.state.player1.groundArena.forEach(u => { if (u.cardId === TURTLE) u.ready = true; });
    await g.attackWithGroundUnitAsync(1, unitIndex(g, TURTLE));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(res(g)).toBeFalsy();
  });

  it("not for Jabba himself, and not for a unit that didn't survive", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());
    await deployed(g);
    const wampa = g.state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, unitIndex(g, JABBA));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa] }); // Jabba takes 4 and survives
    expect(res(g)).toBeFalsy();

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, unitIndex(g, MARINE));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa] }); // the Marine dies
    expect(res(g)).toBeFalsy();
  });

  it("ability damage counts too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TURTLE).WithGroundUnitForPlayer(2, WAMPA)
      .WithCardInHandForPlayer(2, Cards.events.shd.daringRaid).FillResourcesForPlayer(2, MARINE, 4).Build());
    await g.deployLeaderAsync(1); // the opponent acts next

    await g.playCardFromHandAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player1.groundArena[unitIndex(g, TURTLE)].playId] });
    expect(res(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
