import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_191 Shin Hati's Fiend Fighter (1/3 Space, cost 2) —
// "When Defeated: You may give 2 Advantage tokens to a unit. If this unit wasn't defeated by
//  combat damage, you may give 3 Advantage tokens to that unit instead."

function advantageCount(u: { upgrades: { cardId: string }[] }): number {
  return u.upgrades.filter(upg => upg.cardId === "ASH_T02").length;
}

function base(activePlayer: 1 | 2 = 1) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(activePlayer)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_191 Shin Hati's Fiend Fighter — defeated by combat damage", () => {
  it("offers 2 Advantage tokens; accepting gives them to the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.shinHatisFiendFighter) // 1/3, defender
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards) // recipient candidate
        .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // 3/4 attacker — lethal to 3 HP
        .Build(),
    );
    const recipientId = g.state.player1.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena.length).toBe(0); // Shin Hati's Fiend Fighter died

    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [recipientId] });

    const recipient = g.state.player1.groundArena.find(u => u.playId === recipientId)!;
    expect(advantageCount(recipient)).toBe(2);
  });

  it("declining gives no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.shinHatisFiendFighter)
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
        .Build(),
    );
    const recipientId = g.state.player1.groundArena[0].playId;

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseNoAsync(1);

    const recipient = g.state.player1.groundArena.find(u => u.playId === recipientId)!;
    expect(advantageCount(recipient)).toBe(0);
  });
});

describe("ASH_191 Shin Hati's Fiend Fighter — defeated NOT by combat damage", () => {
  it("offers 3 Advantage tokens; accepting gives them to the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.shinHatisFiendFighter, true, 1) // damaged to 2 remaining HP
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards)
        .WithCardInHandForPlayer(2, Cards.events.ash.foundlingRescue)
        .Build(),
    );
    const fiendFighterId = g.state.player1.spaceArena[0].playId;
    const recipientId = g.state.player1.groundArena[0].playId;

    // Player 2 plays Foundling Rescue and defeats the (already-damaged, low-HP) Fiend Fighter
    // via an ability, not combat.
    const handIdx = g.state.player2.hand.findIndex(c => c.cardId === Cards.events.ash.foundlingRescue);
    await g.playCardFromHandAsync(2, handIdx);
    await g.chooseYesAsync(2);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [fiendFighterId] });

    expect(g.state.player1.spaceArena.length).toBe(0);

    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [recipientId] });

    const recipient = g.state.player1.groundArena.find(u => u.playId === recipientId)!;
    expect(advantageCount(recipient)).toBe(3);
  });

  it("declining gives no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.shinHatisFiendFighter, true, 1)
        .WithGroundUnitForPlayer(1, Cards.units.sor.vigilantHonorGuards)
        .WithCardInHandForPlayer(2, Cards.events.ash.foundlingRescue)
        .Build(),
    );
    const recipientId = g.state.player1.groundArena[0].playId;
    const fiendFighterId = g.state.player1.spaceArena[0].playId;

    const handIdx = g.state.player2.hand.findIndex(c => c.cardId === Cards.events.ash.foundlingRescue);
    await g.playCardFromHandAsync(2, handIdx);
    await g.chooseYesAsync(2);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [fiendFighterId] });

    await g.chooseNoAsync(1);

    const recipient = g.state.player1.groundArena.find(u => u.playId === recipientId)!;
    expect(advantageCount(recipient)).toBe(0);
  });
});
