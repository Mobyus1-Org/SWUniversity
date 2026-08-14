import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TargetIds } from "../../test-helpers";

// LOF_176 Lightsaber Throw — Event (Aggression, Tactic), cost 2.
// "Discard a Lightsaber card from your hand. If you do, deal 4 damage to a ground unit and
//  draw a card."
//
// The discard is the condition, not a cost: with no Lightsaber in hand the event is still
// playable, it simply does nothing. Everything after "If you do" — the damage AND the draw —
// hangs off an actual discard having happened.

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithCardInHandForPlayer(1, Cards.events.lof.lightsaberThrow)
    .WithCardInHandForPlayer(1, Cards.upgrades.sor.jediLightsaber) // Item/Weapon/Lightsaber
    .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce); // not a Lightsaber
}

describe("LOF_176 Lightsaber Throw", () => {
  it("discards the chosen Lightsaber, deals 4 damage to a ground unit and draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce) // 6/8, survives
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0); // the Jedi Lightsaber
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.upgrades.sor.jediLightsaber)).toBe(true);
    // Started with 3 cards, played 1, discarded 1, drew 1.
    expect(g.state.player1.hand).toHaveLength(2);
    expect(g.state.player1.deck).toHaveLength(0);
  });

  it("rejects a hand card that is not a Lightsaber", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const result = await g.dispatchAsync(1, "choose-target", {
      targetZones: ["Hand"], targetPlayers: [1], targetIndices: [1], // Consular Security Force
    });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.deck).toHaveLength(1); // no draw yet either
  });

  it("offers only ground units for the damage", async () => {
    const g = new GameTestAdapter();
    const state = baseState()
      .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    const targets = TargetIds(g);
    expect(targets).toContain(state.player2.groundArena[0].playId);
    expect(targets).toContain(state.player1.groundArena[0].playId); // "a ground unit" — either side
    expect(targets).not.toContain(state.player2.spaceArena[0].playId);
  });

  it("control — with no Lightsaber in hand nothing happens: no discard, no damage, no draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.lof.lightsaberThrow)
        .WithCardInHandForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.lof.priestessesOfTheForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.deck).toHaveLength(1);
    expect(g.state.player1.hand).toHaveLength(1); // only the non-Lightsaber unit is left
  });

  it("still discards and draws when there is no ground unit to damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.discard.some(d => d.cardId === Cards.upgrades.sor.jediLightsaber)).toBe(true);
    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });

  it("defeats a ground unit the 4 damage is lethal to", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true, 4) // 3/7 with 4 damage
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});
