import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_235 Galactic Ambition (Event) — Villainy, Cost 7
// Play a non-[Heroism] unit from your hand for free.
// Deal damage to your base equal to its cost.

describe("SOR_235 Galactic Ambition", () => {
  it("plays a non-Heroism unit for free and deals its cost to own base", async () => {
    // Death Trooper (SOR_033): cost 3, Imperial Trooper
    // Playing it for free via Galactic Ambition → own base takes 3 damage
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.events.sor.galacticAmbition)
      .WithCardInHandForPlayer(1, Cards.units.sor.deathTrooper)  // cost 3
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // play Galactic Ambition
    // Prompt to choose a card from hand (the death trooper)
    await g.chooseCardFromHandAsync(1, 0); // pick death trooper (free)

    // Death trooper entered play
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.deathTrooper)).toBe(true);
    // Own base took damage equal to death trooper cost (3)
    expect(g.state.player1.base.damage).toBe(3);
    // The 7 resources were spent on Galactic Ambition itself; death trooper was free
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(0);
  });

  it("cannot play a Heroism unit", async () => {
    // Echo Base Defender (SOR_098): Command+Heroism aspects — should be rejected
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.events.sor.galacticAmbition)
      .WithCardInHandForPlayer(1, Cards.units.sor.echoBaseDefender)  // Heroism unit
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0); // try echo base defender (Heroism)

    // Should be rejected — echo base defender is Heroism
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
