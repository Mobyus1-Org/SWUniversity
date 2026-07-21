import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_222 / TWI_226 Waylay (Event, cost 3, Cunning)
// "Return a non-leader unit to its owner's hand."
//
// "a non-leader unit" — either player's. QA reported friendly units being untargetable, so the
// friendly case is pinned here for both printings.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe.each([
  ["SOR_222", Cards.events.sor.waylay],
  ["TWI_226", Cards.events.twi.waylay],
])("%s Waylay", (_label, waylay) => {
  it("can return a FRIENDLY non-leader unit to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, waylay)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const friendlyPlayId = g.state.player1.groundArena[0].playId;
    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toContain(friendlyPlayId);

    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
  });

  it("can return an ENEMY non-leader unit to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, waylay)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.hand.map(c => c.cardId)).toContain(Cards.units.sor.consularSecurityForce);
  });

  it("cannot target a leader unit on either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .TheirLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithCardInHandForPlayer(1, waylay)
        .WithGroundUnitForPlayer(1, Cards.units.ash.ahsokaTano)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.ash.ahsokaTano)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([
      g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!.playId,
    ]);
  });

  it("returns the unit to its OWNER's hand, not the caster's", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, waylay)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    state.player1.groundArena[0].owner = 2; // controlled by P1, owned by P2
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player2.hand.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("sets a token unit aside instead of returning it to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, waylay)
        .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(0); // tokens cannot go to a hand (CR 7.6.1)
  });

  it("does nothing when the only units in play are leaders", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ash.ahsokaTano, true, true)
        .WithCardInHandForPlayer(1, waylay)
        .WithGroundUnitForPlayer(1, Cards.units.ash.ahsokaTano)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(1);
  });
});
