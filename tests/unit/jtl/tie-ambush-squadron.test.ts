import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// JTL_087 TIE Ambush Squadron (2/3 Space, cost 4, Command/Villainy, Imperial/Vehicle/Fighter) —
//   "Ambush (When you play this unit, it may attack an enemy unit.)
//    When Played/When Defeated: Create a TIE Fighter token."
//
// Ambush was already in the dictionary but untested; both token clauses were missing entirely.
// Because it has BOTH Ambush and a When Played, the two go into the trigger bag together and the
// player orders them — the same path SOR_183 Bounty Hunter Crew takes.
describe("JTL_087 TIE Ambush Squadron", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin) // Command/Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithActivePlayer(1);
  }

  const ties = (g: GameTestAdapter) =>
    g.state.player1.spaceArena.filter(u => u.cardId === Cards.units.token.tieFighter);

  it("has Ambush", () => {
    expect(HasAmbush(Cards.units.jtl.tieAmbushSquadron)).toBe(true);
  });

  it("When Played: creates a TIE Fighter token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.units.jtl.tieAmbushSquadron).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "TIE Ambush Squadron — When Played"); // trigger-order

    expect(ties(g)).toHaveLength(1);
  });

  it("Ambush: it may attack an enemy unit on arrival", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.jtl.tieAmbushSquadron)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10 — survives to be measured
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "TIE Ambush Squadron — Ambush"); // trigger-order
    await g.chooseYesAsync(1);            // take the Ambush attack
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(2); // its printed power
    // The 4-power counter kills the 3-HP Squadron, so When Defeated fires on top of When Played —
    // one token from each half, in a single turn.
    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.jtl.tieAmbushSquadron)).toBe(false);
    expect(ties(g)).toHaveLength(2);
  });

  it("When Defeated: creates another TIE Fighter token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.tieAmbushSquadron)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0); // Vanquish my own Squadron

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.jtl.tieAmbushSquadron)).toBe(false);
    expect(ties(g)).toHaveLength(1);
  });

  it("both halves fire across a full lifecycle — two separate tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.jtl.tieAmbushSquadron)
        .WithCardInHandForPlayer(1, Cards.events.sor.vanquish)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "TIE Ambush Squadron — When Played"); // trigger-order
    expect(ties(g)).toHaveLength(1);

    await g.dispatchAsync(2, "pass-action", {}); // P1 cannot act twice in a row
    await g.playCardFromHandAsync(1, 0);         // Vanquish
    await g.chooseSpaceUnitAsync(1, 0);          // on the Squadron

    expect(ties(g)).toHaveLength(2);
  });

  it("the tokens belong to the Squadron's controller, not the opponent", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.units.jtl.tieAmbushSquadron).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "TIE Ambush Squadron — When Played"); // trigger-order

    expect(ties(g)).toHaveLength(1);
    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("control: an ordinary unit entering play creates no token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.units.sor.tieLnFighter).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(ties(g)).toHaveLength(0);
  });
});
