import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_077 Boss Nass — Otoh Gunga Boss (4/6 Ground, cost 4, Vigilance/Heroism, Gungan) —
//   "When Played/On Attack: You may defeat a Shield token on a friendly Gungan unit. If you do,
//    create a Beast token and give a Shield token to it."
//
// The Shield moves from a Gungan to a brand-new Beast. Only FRIENDLY GUNGAN units carrying a Shield
// are offered; with none, nothing is asked. Both triggers share one handler.

const NASS = Cards.units.hmw.bossNass;
const GUNGAN = Cards.units.hmw.grandArmyMarine; // 2/2 Gungan, no text
const MARINE = Cards.units.sor.battlefieldMarine; // not a Gungan
const BEAST = Cards.units.token.beast;
const SHIELD = Cards.upgrades.token.shield;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });
const shields = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === SHIELD).length;
const beasts = (g: GameTestAdapter) => g.state.player1.groundArena.filter(u => u.cardId === BEAST);

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

describe("HMW_077 Boss Nass", () => {
  describe("When Played", () => {
    it("moves a friendly Gungan's Shield onto a new Beast token", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithCardInHandForPlayer(1, NASS)
          .WithGroundUnitForPlayer(1, GUNGAN)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SHIELD, 1)])
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

      expect(shields(g.state.player1.groundArena[0])).toBe(0);
      expect(beasts(g).length).toBe(1);
      expect(shields(beasts(g)[0])).toBe(1);
    });

    it("may be declined — the Shield stays and no Beast is made", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithCardInHandForPlayer(1, NASS)
          .WithGroundUnitForPlayer(1, GUNGAN)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SHIELD, 1)])
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // the offer was made
      await g.chooseNoAsync(1);

      expect(shields(g.state.player1.groundArena[0])).toBe(1);
      expect(beasts(g).length).toBe(0);
    });

    it("asks nothing when no friendly Gungan holds a Shield (a shielded non-Gungan doesn't count)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithCardInHandForPlayer(1, NASS)
          .WithGroundUnitForPlayer(1, MARINE)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SHIELD, 1)])
          .WithGroundUnitForPlayer(2, GUNGAN)
          .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(SHIELD, 2)])
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
      expect(beasts(g).length).toBe(0);
    });
  });

  describe("On Attack", () => {
    it("can take Boss Nass's own Shield", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, NASS)
          .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(SHIELD, 1)])
          .Build(),
      );

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

      expect(shields(g.state.player1.groundArena[0])).toBe(0);
      expect(beasts(g).length).toBe(1);
      expect(shields(beasts(g)[0])).toBe(1);
      expect(g.state.player2.base.damage).toBe(4); // the attack still lands
    });
  });
});
