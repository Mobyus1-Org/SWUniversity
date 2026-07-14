import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardInPlay } from "@/lib/engine/core-models";

// ASH_195 Helgait (6/4 Ground, cost 5)
// "When Defeated: You may distribute a number of Advantage tokens equal to this unit's power
//  among friendly units (divided as you choose)."

function advantageCount(unit: { upgrades: { cardId: string }[] }): number {
  return unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage).length;
}

function xp(): CardInPlay[] {
  return [{ cardId: Cards.upgrades.token.experience, playId: "@", owner: 1, controller: 1 }];
}

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    // Helgait (6/4) attacks a System Patrol Craft? No — ground. Use two enemy Marines to kill him:
    // he attacks a 3/3 Marine and takes 3; a second hit isn't needed since he has 4 HP... so
    // pre-damage him to 2, then a 3-power trade defeats him.
    .WithGroundUnitForPlayer(1, Cards.units.ash.helgait, true, 2)
    // Two other friendly units to receive tokens.
    .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine);
}

describe("ASH_195 Helgait — When Defeated", () => {
  it("distributes Advantage tokens equal to its power among friendly units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0); // Helgait attacks
    await g.chooseGroundUnitAsync(2, 0); // ...the enemy Marine; 3 damage on 2 already = defeated

    // Helgait's power is 6, so 6 tokens are distributed among friendly units.
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: g.state.player1.groundArena[0].playId, damage: 4 },
        { playId: g.state.player1.groundArena[1].playId, damage: 2 },
      ],
    });

    expect(advantageCount(g.state.player1.groundArena[0])).toBe(4);
    expect(advantageCount(g.state.player1.groundArena[1])).toBe(2);
  });

  it("may put several tokens on a single unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: g.state.player1.groundArena[0].playId, damage: 6 },
      ],
    });

    expect(advantageCount(g.state.player1.groundArena[0])).toBe(6);
    expect(advantageCount(g.state.player1.groundArena[1])).toBe(0);
  });

  it("counts the CURRENT power, including buffs from upgrades", async () => {
    const g = new GameTestAdapter();
    // An Experience token gives Helgait +1/+1 → power 7, HP 5 (pre-damaged 3 → 3 more defeats him).
    const s = setup().WithUpgradesOnGroundUnitForPlayer(1, 0, xp()).Build();
    s.player1.groundArena[0].damage = 3;
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Power is 6 + 1 = 7 tokens to distribute.
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: g.state.player1.groundArena[0].playId, damage: 7 },
      ],
    });

    expect(advantageCount(g.state.player1.groundArena[0])).toBe(7);
  });

  it("is optional — assigning nothing gives no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    const traded = await g.chooseGroundUnitAsync(2, 0);
    // The distribute prompt must actually appear, or assigning nothing would be a silent no-op.
    expect(traded.lastDispatchResponse?.resolutionNeeded?.type).toBe("SpreadDamage");

    await g.dispatchAsync(1, "choose-target", { spreadDamageAssignments: [] });

    expect(advantageCount(g.state.player1.groundArena[0])).toBe(0);
    expect(advantageCount(g.state.player1.groundArena[1])).toBe(0);
  });

  it("no prompt when no other friendly unit survives", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.ash.helgait, true, 2) // Helgait alone
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    const traded = await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena).toHaveLength(0); // Helgait died
    expect(traded.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
