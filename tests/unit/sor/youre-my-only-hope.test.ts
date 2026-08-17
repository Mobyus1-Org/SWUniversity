import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_246 You're My Only Hope (Event, cost 3, Heroism, Gambit)
//   "Look at the top card of your deck. You may play it. It costs 5 resources less.
//    If your base has 5 or less remaining HP, you may play it for free instead."
//
// "Look at" moves nothing: declining must leave the card ON TOP of the deck, not bottom it.

function baseSetup(baseDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, baseDamage)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithCardInHandForPlayer(1, Cards.events.sor.youreMyOnlyHope);
}

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("SOR_246 You're My Only Hope", () => {
  it("plays the top card at 5 resources less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
        // Consular Security Force costs 6; the Command/Heroism leader covers its aspect.
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );
    const before = readyResources(g);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.consularSecurityForce)).toBe(true);
    expect(g.state.player1.deck).toHaveLength(0);
    // 3 for the event itself + max(0, 6 − 5) = 1 for the unit.
    expect(before - readyResources(g)).toBe(4);
  });

  it("plays it for FREE when your base has 5 or less remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup(25) // 30 HP base at 25 damage = 5 remaining
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );
    const before = readyResources(g);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.consularSecurityForce)).toBe(true);
    expect(before - readyResources(g)).toBe(3); // only the event's own cost
  });

  it("6 remaining HP is not 'or less' — the discount is still just 5", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup(24) // 6 remaining
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );
    const before = readyResources(g);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(before - readyResources(g)).toBe(4);
  });

  it("declining leaves the card ON TOP of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce) // the top card
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.deck).toHaveLength(2);
    const top = g.state.player1.deck[g.state.player1.deck.length - 1];
    expect(top.cardId).toBe(Cards.units.sor.consularSecurityForce);
  });

  it("can play a non-unit card — the top card may be an event", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithCardInDeckForPlayer(1, Cards.events.sor.openFire) // "Deal 4 damage to a unit."
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4);
    expect(g.state.player1.deck).toHaveLength(0);
  });

  it("no offer when the reduced cost is unaffordable", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        // Exactly enough for the event itself and nothing more.
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce) // 6 − 5 = 1, unaffordable
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.deck).toHaveLength(1);
  });

  it("does nothing with an empty deck (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20).Build());

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
