import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_091 Republic Tactical Officer (1/4 Ground, cost 2, Command/Heroism, Republic/Clone)
// "When Played: You may attack with a Republic unit. It gets +2/+0 for this attack."
//
// The text says "a Republic unit" with no "another" exclusion, so the Officer is not barred by
// wording — but a unit enters play EXHAUSTED in this engine, and "attack with a unit" abilities
// only ever offer ready units, so in practice it can never pick itself. Same filter as IBH_064.

const OFFICER = Cards.units.twi.republicTacticalOfficer;
const CLONE = Cards.units.twi.phaseIClonetrooper;       // 3/2 Republic/Clone, no card text
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Rebel — NOT Republic

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP) // Command — covers the Officer's Command aspect
    .MyLeader(Cards.leaders.twi.captainRex) // Command/Heroism — covers Heroism too
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, OFFICER);
}

describe("TWI_091 Republic Tactical Officer — When Played: may attack with a Republic unit +2/+0", () => {
  it("the chosen Republic unit attacks with +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CLONE).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    const cloneIndex = g.state.player1.groundArena.findIndex(u => u.cardId === CLONE);
    await g.chooseGroundUnitAsync(1, cloneIndex);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // 3 power + 2
  });

  it("cannot pick itself — a unit enters play exhausted, so it has no legal target alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    // No ready Republic unit exists, so the ability never prompts at all.
    expect(g.state.player1.groundArena.find(u => u.cardId === OFFICER)!.ready).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("declining makes no attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CLONE).Build());

    await g.playCardFromHandAsync(1, 0);
    // Prove the prompt exists — an option dispatched with no pending is a silent no-op.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseOptionAsync(1, "No");

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.groundArena.find(u => u.cardId === CLONE)!.ready).toBe(true);
  });

  it("does not offer a non-Republic unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    const marineIndex = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(1, marineIndex);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("does not offer an ENEMY Republic unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CLONE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("does not offer an exhausted Republic unit", async () => {
    const g = new GameTestAdapter();
    // ready = false — an exhausted unit cannot be attacked with.
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CLONE, false).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    const cloneIndex = g.state.player1.groundArena.findIndex(u => u.cardId === CLONE);
    await g.chooseGroundUnitAsync(1, cloneIndex);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("the +2/+0 lasts only for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CLONE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    const cloneIndex = g.state.player1.groundArena.findIndex(u => u.cardId === CLONE);
    await g.chooseGroundUnitAsync(1, cloneIndex);
    await g.chooseBaseAsync(1, 2);

    const { Unit } = await import("@/server/engine/unit");
    const clone = g.state.player1.groundArena.find(u => u.cardId === CLONE)!;
    expect(Unit.FromInterface(clone).CurrentPower()).toBe(3); // back to printed power
  });
});
