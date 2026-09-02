import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_193 Nightfall (Event, cost 2, Aggression, Disaster) —
//   "Deal 1 damage to an enemy unit."
//   "If you control an Endor base, you may attack with a unit. It gets +2/+0 for this attack."
//
// Two independent halves. The damage is unconditional and mandatory; the attack is gated on an
// Endor base AND optional. Wiring them as one unit would make the damage vanish off-Endor, which
// is the failure this file is built to catch.
//
// "+2/+0 for this attack" is a ForAttack modifier, so it has to be gone once combat ends.

const NIGHTFALL = "HMW_193";
const ENDOR_BASE = "JTL_020";                     // Shield Generator Complex
const PLAIN_BASE = Cards.bases.common.green30HP;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3

function setup(myBase: string = ENDOR_BASE) {
  return new GameStateBuilder()
    .MyBase(myBase)
    .MyLeader(Cards.leaders.sor.sabineWren) // Aggression
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, NIGHTFALL)
    .WithActivePlayer(1);
}

describe("HMW_193 Nightfall", () => {
  it("deals 1 damage to the chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(PLAIN_BASE).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("cannot aim the damage at a friendly unit — 'an enemy unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(PLAIN_BASE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    expect(pending?.type).toBe("Target");
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    expect(offered).toHaveLength(1);
    expect(offered[0]).toBe(g.state.player2.groundArena[0].playId);
  });

  it("offers no attack without an Endor base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(PLAIN_BASE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena[0].damage).toBe(1); // the damage half still happened
  });

  it("with an Endor base, the attacking unit gets +2/+0 for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);          // the 1 damage
    await g.chooseYesAsync(1);                     // yes, attack
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === MARINE);
    await g.chooseGroundUnitAsync(1, idx);         // attack with the Marine
    await g.chooseBaseAsync(1, 2);                 // hit the base

    expect(g.state.player2.base.damage).toBe(5);   // 3 power + 2
  });

  it("the +2/+0 does not linger after the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(5);

    // A second, ordinary attack from the other Marine is unbuffed.
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(8); // 5 + 3, not 5 + 5
  });

  it("the attack is optional — declining leaves the board alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("offers no attack when every friendly unit is exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE, false) // exhausted
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("still offers the attack when the opponent has no units to damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);
  });
});
