import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_006 Supreme Leader Snoke — In the Seat of Power (leader; 4/7 Ground deployed, Command/Villainy)
//   Front: "Action [1 resource, Exhaust]: Give an Experience token to the unit with the most power
//           among friendly Villainy units. (If multiple units are tied, choose one.)"
//   Deployed: "On Attack: Give an Experience token to the unit with the most power among friendly
//             Villainy units."
//
// One clear leader gets the token with no prompt; a tie asks which. Non-Villainy and enemy units
// never count, however strong. Deployed, Snoke is a friendly Villainy unit himself.

const SNOKE = Cards.leaders.lof.supremeLeaderSnoke;
const TROOPER = Cards.units.ibh.firstLegionTrooper; // 3/4 Vigilance/Villainy, no text
const MARINE = Cards.units.sor.battlefieldMarine;                // 3/3 Heroism
const CSF = Cards.units.sor.consularSecurityForce;               // 3/7 Vigilance/Heroism
const XP = Cards.upgrades.token.experience;

const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(SNOKE)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithActivePlayer(1);
}

describe("LOF_006 Supreme Leader Snoke — leader Action", () => {
  it("gives the token to the single most powerful friendly Villainy unit, no prompt", async () => {
    const g = new GameTestAdapter();
    const state = setup()
      .WithGroundUnitForPlayer(1, TROOPER)
      .WithGroundUnitForPlayer(1, TROOPER)
      .WithGroundUnitForPlayer(1, Cards.units.hmw.coastalCatamarans) // 8/8 Vigilance — not Villainy
      .Build();
    state.player1.groundArena[1].upgrades = [{ cardId: XP, playId: "900", owner: 1, controller: 1 }]; // 4 power
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.groundArena.map(xp)).toEqual([0, 2, 0]);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1);
  });

  it("asks which one on a tie", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, TROOPER).WithGroundUnitForPlayer(1, TROOPER).Build());

    await g.useLeaderAbilityAsync(1);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });

    expect(g.state.player1.groundArena.map(xp)).toEqual([0, 1]);
  });

  it("ignores enemy Villainy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, TROOPER).WithGroundUnitForPlayer(2, Cards.units.hmw.coastalCatamarans).Build());

    await g.useLeaderAbilityAsync(1);

    expect(xp(g.state.player1.groundArena[0])).toBe(1);
  });

  it("with no friendly Villainy unit, pays and does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).Build());

    await g.useLeaderAbilityAsync(1);

    expect(xp(g.state.player1.groundArena[0])).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
  });
});

describe("LOF_006 Supreme Leader Snoke — deployed On Attack", () => {
  it("gives the token to the most powerful friendly Villainy unit — Snoke himself counts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().MyLeader(SNOKE, true, true).WithGroundUnitForPlayer(1, SNOKE).WithGroundUnitForPlayer(1, TROOPER).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(xp(g.state.player1.groundArena[0])).toBe(1); // Snoke, 4 power, beats the 3-power Trooper
    expect(xp(g.state.player1.groundArena[1])).toBe(0);
    expect(g.state.player2.base.damage).toBe(5); // 4 + the XP, given before damage
  });
});
