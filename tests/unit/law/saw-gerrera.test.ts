import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_001 Saw Gerrera — Bring Down the Empire (Leader, Command/Aggression; unit side 4/7 Ground)
//   Front: "Action [Exhaust]: Attack with a unit. It gets +2/+0 and gains Overwhelm for this attack.
//           After completing this attack, defeat it.
//           Epic Action: If you control 6 or more resources, deploy this leader."
//   Unit:  "When Attack Ends: If this unit survived, you may attack with another unit. It gets +2/+0
//           and gains Overwhelm for this attack. After completing this attack, defeat it."
// The defeat comes after the attack has fully resolved — its own When Attack Ends included.

const SAW = Cards.leaders.law.sawGerrera;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const WAMPA = Cards.units.sor.wampa;              // 4/5
const TURTLE = Cards.units.ash.dinosaurTurtle;    // 7/7
const HK87 = Cards.units.lof.hk87AssassinDroid;   // 4/4 — When Defeated: 2 to each ground unit

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(SAW)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;

describe("LAW_001 Saw Gerrera — leader Action", () => {
  it("+2/+0 and Overwhelm for the attack, then the attacker is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TURTLE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(6); // 9 power – 3 HP spills over
    expect(g.state.player1.groundArena).toHaveLength(0); // then defeated
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(TURTLE);
  });

  it("an attacker that dies in combat is simply gone — nothing breaks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, TURTLE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(5);
    expect(res(g)).toBeFalsy();
  });

  it("the defeated unit's When Defeated still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HK87).WithGroundUnitForPlayer(2, TURTLE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(6);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(2); // HK-87's blast
  });

  it("the attacker's own When Attack Ends resolves first, then it is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, Cards.units.ash.rukh).WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid).Build());
    const rukh = g.state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [rukh] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(res(g)?.type).toBe("Option"); // Rukh's Advantage tokens — Rukh still in play
    expect(g.state.player1.groundArena.map(u => u.playId)).toContain(rukh);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(3);
  });

  it("control: a later ordinary attack by another unit defeats nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TURTLE).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
  });
});

describe("LAW_001 Saw Gerrera — deployed When Attack Ends", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const sawIndex = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === SAW);

  it("after Saw survives, another unit attacks with +2/+0 and Overwhelm, then is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, sawIndex(g));
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(4);
    await g.chooseYesAsync(1);
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(6); // 5 power – 3 HP
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([SAW]);
  });

  it("can be passed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, sawIndex(g));
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena).toHaveLength(2);
  });

  it("not offered if Saw died", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, TURTLE, true, 0).Build());
    g.state.player2.groundArena[0].damage = 0;
    await deployed(g);
    g.state.player1.groundArena[sawIndex(g)].damage = 4; // 3 left; the turtle hits for 7

    await g.attackWithGroundUnitAsync(1, sawIndex(g));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(res(g)).toBeFalsy();
  });

  it("the Saw attack itself is not defeated afterwards", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, sawIndex(g));
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([SAW]);
  });
});
