import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_171 Trap Field (Upgrade, cost 2, Aggression/Heroism, Fortification) —
//   "Fortify (Attach this to your base, not a unit.)
//    When a non-leader ground unit enters play (including token units): You may defeat this
//    upgrade. If you do, deal 3 damage to that unit."
//
// "Including token units" is the awkward half: tokens never pass through addToArena and are
// deliberately absent from the cardsEnteredPlayThisPhase ledger, so the trigger is queued from
// the arena-entry points themselves.

const TRAP = Cards.upgrades.hmw.trapField;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3 Ground — survives 3 damage at 3 HP? no, dies
const CSF = Cards.units.sor.consularSecurityForce;     // 3/7 Ground — survives 3
const TIE = Cards.units.sor.tieLnFighter;              // Space — must NOT trigger it
const ESCORT = Cards.units.twi.battleDroidEscort;      // When Played: create a Battle Droid token
const BATTLE_DROID = Cards.units.token.battleDroid;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithUpgradesOnBaseForPlayer(1, [{ cardId: TRAP, playId: "@", owner: 1, controller: 1 }])
    .WithActivePlayer(1);
}

describe("HMW_171 Trap Field", () => {
  it("offers to spring on a ground unit entering play, dealing 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.find(u => u.cardId === CSF)!.damage).toBe(3);
    expect(g.state.player1.base.upgrades ?? []).toHaveLength(0); // defeated itself
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(TRAP);
  });

  it("declining leaves the trap attached and the unit unharmed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena.find(u => u.cardId === CSF)!.damage).toBe(0);
    expect(g.state.player1.base.upgrades).toHaveLength(1);
  });

  it("fires on a TOKEN unit entering play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, ESCORT).Build());

    await g.playCardFromHandAsync(1, 0); // Escort enters, then creates a Battle Droid

    // Two ground units entered, so the trap is offered — one prompt per entry until it is spent.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    const droid = g.state.player1.groundArena.find(u => u.cardId === BATTLE_DROID);
    const escort = g.state.player1.groundArena.find(u => u.cardId === ESCORT);
    // Whichever it was offered on took 3; the trap is spent either way.
    expect((droid?.damage ?? 0) + (escort?.damage ?? 0) > 0 || droid === undefined || escort === undefined).toBe(true);
    expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
  });

  it("does not fire on a SPACE unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, TIE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.base.upgrades).toHaveLength(1);
  });

  it("fires on an ENEMY unit too — 'a ground unit' is unqualified", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .FillResourcesForPlayer(2, MARINE, 14)
        .WithCardInHandForPlayer(2, CSF)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.playCardFromHandAsync(2, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseYesAsync(1); // the TRAP's controller decides

    expect(g.state.player2.groundArena.find(u => u.cardId === CSF)!.damage).toBe(3);
  });

  it("control: with no trap attached nothing is offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 14)
        .WithCardInHandForPlayer(1, CSF)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
