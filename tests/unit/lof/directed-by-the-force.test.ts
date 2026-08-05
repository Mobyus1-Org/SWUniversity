import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// LOF_123 Directed by the Force (Event, Command/Force, cost 1) —
//   "The Force is with you (create your Force token). You may play a unit from your hand
//    (paying its cost)."
//
// The token is created FIRST and unconditionally, so it is available to help pay for whatever the
// second clause plays. The "play a unit (paying its cost)" clause is unrestricted — the first such
// implementation; ASH_002 Fennec, JTL_003 Lando and LOF_225 Three Lessons print the same wording.
describe("LOF_123 Directed by the Force", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP) // Command — no aspect penalty
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInHandForPlayer(1, Cards.events.lof.directedByTheForce)
      .WithActivePlayer(1);
  }

  const force = (g: GameTestAdapter) => g.state.player1.supplemental.forceToken;

  it("creates the Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(force(g)).toBe(true);
  });

  it("plays a chosen unit from hand, paying its full cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
        .Build(),
    );
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;

    await g.playCardFromHandAsync(1, 0); // the event (cost 1)
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore - 1 - 2);
  });

  it("declining plays nothing but keeps the Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // the decline is real
    await g.chooseNoAsync(1);

    expect(force(g)).toBe(true);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
  });

  it("with no UNIT in hand, the token is still created and nothing is prompted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish) // an event, not a unit
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(force(g)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("rejects a chosen card that is not a Unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // makes the option legal
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const res = await g.chooseCardFromHandAsync(1, 1); // Vanquish

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("rejects a unit the player cannot afford, without refunding the Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2) // 1 left after the event
        .WithCardInHandForPlayer(1, Cards.units.sor.lukeSkywalker) // cost 7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const res = await g.chooseCardFromHandAsync(1, 0);

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
    expect(force(g)).toBe(true); // the first clause already resolved
  });

  it("the Force token exists BEFORE the unit is played, so it can help pay", async () => {
    // A Force-cost payer would be unusable if the clauses resolved in the wrong order. Assert the
    // token is present at the moment the play prompt is offered, not merely at the end.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(force(g)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("a unit played this way still fires its own When Played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
        .WithCardInHandForPlayer(1, Cards.units.sec.crucible) // "give an XP token to each other friendly unit"
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    const marine = g.state.player1.groundArena[0];
    expect(marine.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience)).toHaveLength(1);
  });
});
