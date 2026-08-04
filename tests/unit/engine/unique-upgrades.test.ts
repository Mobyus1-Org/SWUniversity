import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// The duplicate-unique rule was enforced for UNITS only — `completePlayCard` checks CardIsUnique
// inside its unit branch, and upgrades never reached it. A player could therefore stack two copies
// of a unique upgrade, which the rules forbid.
//
// Unlike the unit case there is no choice to present: at most one copy can already be in play, so
// the existing one is defeated outright when the second is attached.
describe("unique upgrades — playing a second copy defeats the first", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
      .WithActivePlayer(1);
  }

  const UNIQUE = Cards.upgrades.sor.lukesLightsaber;   // SOR_053, unique
  const NON_UNIQUE = Cards.upgrades.sor.jediLightsaber; // SOR_054, not unique

  const upgradesOn = (g: GameTestAdapter, i: number) =>
    g.state.player1.groundArena[i].upgrades.map(u => u.cardId);

  it("moving a unique upgrade to a second unit leaves only one copy in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(UNIQUE, 1)])
        .WithCardInHandForPlayer(1, UNIQUE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1); // attach the new copy to the OTHER unit

    expect(upgradesOn(g, 0)).not.toContain(UNIQUE); // the old copy is gone
    expect(upgradesOn(g, 1)).toContain(UNIQUE);
    const total = g.state.player1.groundArena.flatMap(u => u.upgrades).filter(u => u.cardId === UNIQUE);
    expect(total).toHaveLength(1);
  });

  it("the defeated copy goes to its owner's discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(UNIQUE, 1)])
        .WithCardInHandForPlayer(1, UNIQUE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1);

    expect(g.state.player1.discard.map(d => d.cardId)).toContain(UNIQUE);
  });

  it("control: a NON-unique upgrade may be held twice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(NON_UNIQUE, 1)])
        .WithCardInHandForPlayer(1, NON_UNIQUE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1);

    expect(upgradesOn(g, 0)).toContain(NON_UNIQUE);
    expect(upgradesOn(g, 1)).toContain(NON_UNIQUE);
  });

  it("control: the OPPONENT's copy of the same unique upgrade is untouched", async () => {
    // Uniqueness is per player — "you can't control two copies", not "only one exists".
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.echoBaseDefender)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(UNIQUE, 2)])
        .WithCardInHandForPlayer(1, UNIQUE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(upgradesOn(g, 0)).toContain(UNIQUE);
    expect(g.state.player2.groundArena[0].upgrades.map(u => u.cardId)).toContain(UNIQUE);
  });
});
