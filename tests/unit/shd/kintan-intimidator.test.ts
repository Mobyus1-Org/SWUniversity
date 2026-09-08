import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_183 Kintan Intimidator (1/4 Ground, cost 1, Underworld) — "On Attack: Exhaust the defender."
//
// The defender only exists once the attack target has been chosen, which is exactly when On Attack
// fires — the trigger reads it off the pending attack's target. Attacking a BASE therefore has no
// defender at all and the ability simply does nothing.
//
// Exhausting the defender does not stop it counter-attacking: counter-damage is part of the same
// attack, not a separate action. That is worth pinning, because "exhaust" reads like it should.

const KINTAN = "SHD_183";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, KINTAN)
    .WithActivePlayer(1);
}

describe("SHD_183 Kintan Intimidator", () => {
  it("exhausts the unit it attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("does nothing when attacking a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.groundArena[0].ready).toBe(true); // untouched
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("the defender still counter-attacks — exhausting is not preventing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(3); // took the 3-power counter
  });

  it("an already-exhausted defender is simply left exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("control: a unit without the ability leaves the defender ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).Build());

    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.attackWithGroundUnitAsync(1, idx);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });
});
