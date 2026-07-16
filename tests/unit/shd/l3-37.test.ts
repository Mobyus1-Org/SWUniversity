import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { SmuggleCost, SmuggleAspects } from "@/server/engine/card-db/keyword-dictionaries.ts/smuggle";

// SHD_197 L3-37 (2/2 Ground) —
//   "When Played: You may rescue a captured card. If you don't, give a Shield token to this unit.
//    Smuggle [4, Cunning, Heroism]"
describe("SHD_197 L3-37", () => {
  const CAPTIVE_ID = "cap1";

  function build(withCaptive: boolean) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.shd.l337);
    if (withCaptive) b.WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine); // the captor
    const state = b.Build();
    if (withCaptive) {
      // A player-1-owned unit held captive under the player-2 captor.
      state.player2.groundArena[0].captives = [{
        cardId: Cards.units.sor.battlefieldMarine,
        playId: CAPTIVE_ID,
        owner: 1,
        controller: 1,
        ready: false,
        damage: 0,
        upgrades: [],
        captives: [],
        numUses: 0,
        isClone: false,
      }];
    }
    return state;
  }

  function l337(g: GameTestAdapter) {
    return g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.l337)!;
  }

  it("When Played: rescues a captured card (returns it to its owner's arena exhausted)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build(true));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // Rescue

    const rescued = g.state.player1.groundArena.find(u => u.playId === CAPTIVE_ID);
    expect(rescued).toBeDefined();
    expect(rescued?.ready).toBe(false);
    // The captor no longer holds it.
    expect(g.state.player2.groundArena[0].captives.length).toBe(0);
    // L3-37 did not get a Shield (it rescued instead).
    expect(l337(g).upgrades.length).toBe(0);
  });

  it("When Played: declining the rescue gives L3-37 a Shield token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build(true));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // Give Shield

    expect(l337(g).upgrades.filter(u => u.cardId === Cards.upgrades.token.shield)).toHaveLength(1);
    // The captive is untouched.
    expect(g.state.player2.groundArena[0].captives.length).toBe(1);
  });

  it("When Played: with no captured card, auto-gives L3-37 a Shield token (no prompt)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build(false));

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(l337(g).upgrades.filter(u => u.cardId === Cards.upgrades.token.shield)).toHaveLength(1);
  });

  it("Smuggle bracket is [4, Cunning, Heroism]", () => {
    expect(SmuggleCost(Cards.units.shd.l337)).toBe(4);
    expect(SmuggleAspects(Cards.units.shd.l337)).toEqual(["Cunning", "Heroism"]);
  });
});
