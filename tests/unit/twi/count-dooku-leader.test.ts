import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("TWI_005 Count Dooku (Leader) — Action [Exhaust]: Play a Separatist card from hand. It gains Exploit 1.", () => {
  it("Happy path: plays Admiral Trench (Exploit 1 native + 1 from Dooku = Exploit 2), player declines Exploit, pays full cost 7, Trench enters arena", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Admiral Trench costs 7; give exactly 7 resources
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)
      .Build();
    g.loadNewState(state);

    // Use Dooku's action ability → expects play-from-hand resolution
    await g.useLeaderAbilityAsync(1);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");

    // Choose Admiral Trench from hand (index 0)
    await g.chooseCardFromHandAsync(1, 0);
    // Now in exploit-option; Dooku grants +1, Admiral Trench has native Exploit 1 → Exploit 2
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    // Decline Exploit — pay full cost of 7
    await g.chooseNoAsync(1);

    // Admiral Trench should be in the ground arena
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.admiralTrench)).toBe(true);
    // All 7 resources should be exhausted
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(0);
    // Dooku should be exhausted
    expect(g.state.player1.leader.ready).toBe(false);
    // Hand should be empty
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.twi.admiralTrench)).toBe(false);
  });

  it("Rejection: cannot play a non-Separatist card (Battlefield Marine) via Dooku's action", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      // Put a Separatist card in hand too so the ability can fire
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    // Use Dooku's action ability
    await g.useLeaderAbilityAsync(1);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");

    // Try to choose the non-Separatist Battlefield Marine (index 1)
    await g.chooseCardFromHandAsync(1, 1);

    // The dispatch should have been rejected
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    // Battlefield Marine should still be in hand
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    // Ground arena should still be empty
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
  });
});
