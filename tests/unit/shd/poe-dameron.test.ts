import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_153 Poe Dameron - Quick to Improvise (6/6 Ground, cost 5) —
//   "On Attack: Discard up to 3 cards from your hand. For each card discarded this way, choose a
//    different option:
//      • Deal 2 damage to a unit or base.
//      • Defeat an upgrade.
//      • An opponent discards a card from their hand."
describe("SHD_153 Poe Dameron - Quick to Improvise", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.sabineWren) // Aggression/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithActivePlayer(1);
  }

  /** Poe attacking the enemy base, with `hand` cards to spend. */
  function attacking(...hand: string[]) {
    let b = base().WithGroundUnitForPlayer(1, Cards.units.shd.poeDameron);
    for (const c of hand) b = b.WithCardInHandForPlayer(1, c);
    return b;
  }

  it("discards 1 and deals 2 damage to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attacking(Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);            // attack the base
    await g.chooseCardFromHandAsync(1, 0);    // discard the Marine
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] }); // stop discarding
    await g.chooseOptionAsync(1, "damage");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.discard.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(6); // the attack itself
  });

  it("can aim the 2 damage at a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attacking(Cards.units.sor.battlefieldMarine).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });
    await g.chooseOptionAsync(1, "damage");
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(8); // 6 combat + 2
  });

  it("defeats an upgrade with the upgrade mode", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attacking(Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.sor.jediLightsaber, playId: "@", owner: 2, controller: 2 },
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });
    await g.chooseOptionAsync(1, "upgrade");
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);

    expect(g.state.player2.groundArena[0].upgrades.length).toBe(0);
  });

  it("makes the opponent discard with the discard mode", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attacking(Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(2, Cards.units.sor.echoBaseDefender)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });
    await g.chooseOptionAsync(1, "discard");
    await g.chooseCardFromHandAsync(2, 0); // the opponent picks

    expect(g.state.player2.hand.length).toBe(0);
    expect(g.state.player2.discard.some(c => c.cardId === Cards.units.sor.echoBaseDefender)).toBe(true);
  });

  it("discarding 3 lets all three different options be used", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attacking(
        Cards.units.sor.battlefieldMarine,
        Cards.units.sor.echoBaseDefender,
        Cards.units.sor.wampa,
      )
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.sor.jediLightsaber, playId: "@", owner: 2, controller: 2 },
        ])
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0); // all three discarded — no stop needed

    await g.chooseOptionAsync(1, "damage");
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "upgrade");
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);
    await g.chooseOptionAsync(1, "discard");
    await g.chooseCardFromHandAsync(2, 0);

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena[0].upgrades.length).toBe(0);
    expect(g.state.player2.hand.length).toBe(0);
  });

  it("rejects reusing a mode already taken this attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attacking(Cards.units.sor.battlefieldMarine, Cards.units.sor.echoBaseDefender)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    await g.chooseOptionAsync(1, "damage");
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "damage"); // same mode again

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("discarding nothing skips the modes entirely", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attacking(Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] }); // discard none

    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(6); // the attack still resolved
  });

  it("control: with an empty hand there is no prompt at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attacking()
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("caps the discard at 3 even with a bigger hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      attacking(
        Cards.units.sor.battlefieldMarine,
        Cards.units.sor.echoBaseDefender,
        Cards.units.sor.wampa,
        Cards.units.sor.reinforcementWalker,
      )
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.sor.jediLightsaber, playId: "@", owner: 2, controller: 2 },
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    // A 4th card remains in hand — the discard step ended after 3.
    expect(g.state.player1.hand.length).toBe(1);

    await g.chooseOptionAsync(1, "damage");
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseOptionAsync(1, "upgrade");
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);
    await g.chooseOptionAsync(1, "discard");
    await g.chooseCardFromHandAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
