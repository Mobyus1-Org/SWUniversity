import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { ADVANTAGE_TOKEN } from "@/server/engine/token-helpers";
import { Cards } from "../../card-helpers";

// ASH_235 Sense Through the Force (Event, cost 2)
// "Choose a number, then search the top 5 cards of your deck for a card, reveal it, and draw it.
//  If its cost is the chosen number, you may give 3 Advantage tokens to a Force unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

/** tempId of the drawn card, taken from the DeckSearch resolution. */
function deckChoice(g: GameTestAdapter, cardId: string) {
  const res = g.lastDispatchResponse?.resolutionNeeded as {
    choices?: { tempId: string; cardId: string }[];
  };
  return res.choices!.find(c => c.cardId === cardId)!.tempId;
}

describe("ASH_235 Sense Through the Force", () => {
  it("draws the chosen card and, on a cost match, gives 3 Advantage tokens to a Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.senseThroughTheForce)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce) // cost 4
        .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)           // Force, Jedi
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "4");
    await g.chooseDeckSearchAsync(1, [deckChoice(g, Cards.units.sor.consularSecurityForce)]);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.consularSecurityForce);
    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(3);
  });

  it("may decline the tokens even on a cost match", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.senseThroughTheForce)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "4");
    await g.chooseDeckSearchAsync(1, [deckChoice(g, Cards.units.sor.consularSecurityForce)]);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.consularSecurityForce);
  });

  it("still draws but gives nothing when the cost does not match", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.senseThroughTheForce)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce) // cost 4
        .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "2"); // wrong number
    await g.chooseDeckSearchAsync(1, [deckChoice(g, Cards.units.sor.consularSecurityForce)]);

    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.consularSecurityForce);
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("gives nothing when the match happens but no Force unit is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.senseThroughTheForce)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel, Trooper
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "4");
    await g.chooseDeckSearchAsync(1, [deckChoice(g, Cards.units.sor.consularSecurityForce)]);

    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("can only target a FORCE unit with the tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.senseThroughTheForce)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not Force
        .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)       // Force
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "4");
    await g.chooseDeckSearchAsync(1, [deckChoice(g, Cards.units.sor.consularSecurityForce)]);
    await g.chooseYesAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([
      g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.kelleranBeq)!.playId,
    ]);
  });

  it("takes nothing when the player picks no card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.senseThroughTheForce)
        .WithCardInDeckForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "4");
    await g.chooseDeckSearchAsync(1, []);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
  });
});
