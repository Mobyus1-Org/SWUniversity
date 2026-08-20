import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { CardTitle } from "@/server/engine/card-db/generated";
import type { NeedsPeekHand, NeedsTarget } from "@/lib/engine/message-types";

// SEC_210 Stolen Starpath Unit (Upgrade, cost 1, +1/+1, Cunning/Heroism, Item/Modification) —
//   "Attached unit gains: 'On Attack: Name a card. The defending player reveals their hand.
//    For each card in their hand with that name, create a Spy token.'"
//
// The count is by NAME, so two copies in hand make two Spy tokens. The Spies belong to the
// attacking player. "The defending player" follows the attack target — the base's owner when
// hitting a base, the defending unit's controller when hitting a unit.

const STARPATH = Cards.upgrades.sec.stolenStarpathUnit;
const MARINE = Cards.units.sor.battlefieldMarine;
const CLONE = Cards.units.twi.phaseIClonetrooper;
const SPY = Cards.units.token.spy;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithUpgradesOnGroundUnitForPlayer(1, 0, [
      { cardId: STARPATH, playId: "@", owner: 1, controller: 1 },
    ]);
}

const spyCount = (g: GameTestAdapter, player: 1 | 2) =>
  (player === 1 ? g.state.player1 : g.state.player2).groundArena.filter(u => u.cardId === SPY).length;

describe("SEC_210 Stolen Starpath Unit", () => {
  it("gives the attached unit +1/+1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    const host = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(host.CurrentPower()).toBe(4); // Marine 3 + 1
    expect(host.TotalHP()).toBe(4);      // Marine 3 + 1
  });

  it("creates one Spy per copy of the named card in the defender's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInHandForPlayer(2, CLONE)
        .WithCardInHandForPlayer(2, CLONE)  // two copies of the named card
        .WithCardInHandForPlayer(2, MARINE) // a different name — must not count
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const namePrompt = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(namePrompt.type).toBe("Target");
    expect(namePrompt.fromChoices).toContain(CardTitle(CLONE));

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(CLONE)] });

    // The defending player's hand is revealed to the attacker.
    const peek = g.lastDispatchResponse!.resolutionNeeded as NeedsPeekHand;
    expect(peek.type).toBe("PeekHand");
    expect(peek.targetPlayer).toBe(2);
    expect(peek.mustDiscard).toBe(false); // a reveal only — nothing is discarded

    await g.dispatchAsync(1, "choose-target", {});

    expect(spyCount(g, 1)).toBe(2);
    expect(spyCount(g, 2)).toBe(0); // the Spies belong to the attacker
    expect(g.state.player2.hand).toHaveLength(3); // nothing left their hand
  });

  it("naming a card they do not hold still reveals, but makes no Spy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(CLONE)] });

    const peek = g.lastDispatchResponse!.resolutionNeeded as NeedsPeekHand;
    expect(peek.type).toBe("PeekHand");

    await g.dispatchAsync(1, "choose-target", {});

    expect(spyCount(g, 1)).toBe(0);
  });

  it("the defending player is the defending UNIT's controller", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, CLONE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack the enemy Marine, not the base
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(CLONE)] });

    const peek = g.lastDispatchResponse!.resolutionNeeded as NeedsPeekHand;
    expect(peek.targetPlayer).toBe(2);

    await g.dispatchAsync(1, "choose-target", {});

    expect(spyCount(g, 1)).toBe(1);
  });

  it("does not prompt when the defending player's hand is empty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(4); // the attack still landed, 3 + 1
  });

  it("control: the same unit without the upgrade has no On Attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 14)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithCardInHandForPlayer(2, CLONE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(spyCount(g, 1)).toBe(0);
    expect(g.state.player2.base.damage).toBe(3); // no +1/+0 either
  });
});
