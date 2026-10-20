import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// The duplicate-unique rule was enforced for UNITS only — `completePlayCard` checks CardIsUnique
// inside its unit branch, and upgrades never reached it. A player could therefore stack two copies
// of a unique upgrade, which the rules forbid.
//
// The player chooses which copy dies, here as everywhere: CR 8.29.3 — "If a player ever has more
// than one copy of a unique card in play under their control at a given time, they must defeat one
// of them." This used to cull the older copy outright on the assumption that an upgrade had no
// choice to offer, which is wrong twice over — both copies are equally eligible, and the other
// copy may not even be an upgrade (CR 8.29.3a).
describe("unique upgrades — playing a second copy prompts to defeat one", () => {
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

  /** Two Marines, a unique upgrade already on the first, a second copy in hand. */
  function twoCopiesSetup() {
    return base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(UNIQUE, 1)])
      .WithCardInHandForPlayer(1, UNIQUE);
  }

  it("attaching a second copy prompts, offering both copies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(twoCopiesSetup().Build());
    const oldCopy = g.state.player1.groundArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1); // attach the new copy to the OTHER unit

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined;
    expect(res?.fromPlayIds).toHaveLength(2);
    expect(res?.fromPlayIds).toContain(oldCopy);
  });

  it("choosing the old copy leaves only the new one in play, and discards the old", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(twoCopiesSetup().Build());
    const oldCopy = g.state.player1.groundArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [oldCopy] });

    expect(upgradesOn(g, 0)).not.toContain(UNIQUE);
    expect(upgradesOn(g, 1)).toContain(UNIQUE);
    const total = g.state.player1.groundArena.flatMap(u => u.upgrades).filter(u => u.cardId === UNIQUE);
    expect(total).toHaveLength(1);
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(UNIQUE);
  });

  it("choosing the NEW copy instead is equally legal and leaves the old one attached", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(twoCopiesSetup().Build());
    const oldCopy = g.state.player1.groundArena[0].upgrades[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] } | undefined;
    const newCopy = res!.fromPlayIds!.find(id => id !== oldCopy)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [newCopy] });

    expect(upgradesOn(g, 0)).toContain(UNIQUE);
    expect(upgradesOn(g, 1)).not.toContain(UNIQUE);
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
