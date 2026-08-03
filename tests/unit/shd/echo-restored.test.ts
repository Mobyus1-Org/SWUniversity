import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

const EXPERIENCE = Cards.upgrades.token.experience;

// SHD_099 Echo - Restored (4/4 Ground, cost 4) —
//   "Restore 2
//    When Played: You may discard a card from your hand. Give 2 Experience tokens to a unit in
//    play with the same name as the discarded card."
describe("SHD_099 Echo - Restored", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === EXPERIENCE).length;

  it("has Restore 2", () => {
    expect(RestoreAmount(Cards.units.shd.echoRestored)).toBe(2);
  });

  it("discarding a card gives 2 Experience to a same-named unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // same name as the discard
        .WithCardInHandForPlayer(1, Cards.units.shd.echoRestored)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // discard the Marine
    await g.chooseGroundUnitAsync(1, 0);   // the matching Marine in play

    expect(xp(g.state.player1.groundArena[0])).toBe(2);
    expect(g.state.player1.discard.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
  });

  it("can give the tokens to an ENEMY unit with the same name ('a unit in play')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.echoRestored)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(xp(g.state.player2.groundArena[0])).toBe(2);
  });

  it("a unit with a DIFFERENT name is not a legal target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender) // different name
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.echoRestored)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // the Echo Base Defender

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(xp(g.state.player1.groundArena[0])).toBe(0);
  });

  it("discarding a card with no name match in play gives nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)
        .WithCardInHandForPlayer(1, Cards.units.shd.echoRestored)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    // The card is still discarded; there is simply nothing to give tokens to.
    expect(g.state.player1.discard.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(xp(g.state.player1.groundArena[0])).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("declining discards nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.echoRestored)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.length).toBe(1);
    expect(xp(g.state.player1.groundArena[0])).toBe(0);
  });

  it("control: no prompt with an empty hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.echoRestored)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(xp(g.state.player1.groundArena[0])).toBe(0);
  });
});
