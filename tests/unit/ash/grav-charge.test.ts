import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_085 Grav Charge. Cost 1 Vigilance Condition/Item/Weapon upgrade.
//   "When attached unit's attack ends: Deal 4 damage to it and defeat this upgrade."
//
// It fires only when the HOST attacked — being attacked is not "its attack". One shot: the upgrade
// defeats itself, so a second attack costs nothing.

const GRAV = Cards.upgrades.ash.gravCharge;
const BIG = Cards.units.sor.consularSecurityForce; // 3/7 Ground — survives the 4 and can attack again
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3 Ground — the 4 is lethal

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14);
}

const grav = (owner: 1 | 2) => GameStateBuilder.Upgrade(GRAV, owner);

describe("ASH_085 Grav Charge", () => {
  it("deals 4 to the attached unit and defeats itself when that unit's attack ends", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, BIG)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [grav(1)])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const host = g.state.player1.groundArena[0];
    expect(host.damage).toBe(4);
    expect(host.upgrades.filter(u => u.cardId === GRAV)).toHaveLength(0);
    expect(g.state.player1.discard.some(c => c.cardId === GRAV)).toBe(true);
  });

  it("defeats the host outright when 4 is lethal, and both go to the discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, MARINE) // 3/3
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [grav(1)])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.some(c => c.cardId === MARINE)).toBe(true);
    expect(g.state.player1.discard.some(c => c.cardId === GRAV)).toBe(true);
  });

  it("does NOT fire when the attached unit merely DEFENDS", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, BIG)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [grav(1)])
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    const defender = g.state.player1.groundArena[0].playId;
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [defender] });

    const host = g.state.player1.groundArena[0];
    expect(host.damage).toBe(3); // only the combat damage, not the extra 4
    expect(host.upgrades.filter(u => u.cardId === GRAV)).toHaveLength(1);
  });

  it("is one-shot — a second attack by the same unit adds nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, BIG)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [grav(1)])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player1.groundArena[0].damage).toBe(4);

    // Ready it and attack again — the upgrade is gone, so no further damage.
    g.state.player1.groundArena[0].ready = true;
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.groundArena[0].damage).toBe(4);
  });

  it("also fires on an ENEMY unit carrying it — the text says 'attached unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(2, BIG)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [grav(1)]) // player 1 played it onto their unit
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    const host = g.state.player2.groundArena[0];
    expect(host.damage).toBe(4);
    expect(host.upgrades.filter(u => u.cardId === GRAV)).toHaveLength(0);
  });
});
