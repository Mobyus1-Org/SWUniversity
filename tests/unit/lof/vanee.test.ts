import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_082 Vaneé — 2/2 Ground (Imperial Sith Official), cost 2.
// "When Played/On Attack: You may defeat an Experience token on a friendly unit.
//  If you do, give an Experience token to a friendly unit."

const xpCount = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(up => up.cardId === Cards.upgrades.token.experience).length;

describe("LOF_082 Vaneé", () => {
  describe("When Played", () => {
    it("offers a Yes/No choice when a friendly unit carries an Experience token", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // [0] carries XP
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
        ])
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInHandForPlayer(1, Cards.units.lof.vanee)
        .WithActivePlayer(1)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    });

    it("Yes: defeats an Experience token on one unit and gives one to another", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // [0] carries XP (defeat source)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
        ])
        .WithGroundUnitForPlayer(1, Cards.units.sor.echoBaseDefender)  // [1] recipient
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInHandForPlayer(1, Cards.units.lof.vanee)
        .WithActivePlayer(1)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);
      await g.chooseGroundUnitAsync(1, 0); // defeat the XP token on the marine
      await g.chooseGroundUnitAsync(1, 1); // give an XP token to the echo base defender

      expect(xpCount(g.state.player1.groundArena[0])).toBe(0);
      expect(xpCount(g.state.player1.groundArena[1])).toBe(1);
    });

    it("No: leaves all Experience tokens untouched", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
        ])
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInHandForPlayer(1, Cards.units.lof.vanee)
        .WithActivePlayer(1)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1);

      expect(xpCount(g.state.player1.groundArena[0])).toBe(1);
    });

    it("no friendly Experience token in play: does not prompt", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInHandForPlayer(1, Cards.units.lof.vanee)
        .WithActivePlayer(1)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
    });
  });

  describe("On Attack", () => {
    it("Yes: moves an Experience token when Vaneé attacks", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.lof.vanee)             // [0] attacker
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // [1] carries XP
        .WithUpgradesOnGroundUnitForPlayer(1, 1, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
        ])
        .WithActivePlayer(1)
        .Build();
      g.loadNewState(state);

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      await g.chooseYesAsync(1);
      await g.chooseGroundUnitAsync(1, 1); // defeat XP on the marine
      await g.chooseGroundUnitAsync(1, 0); // give XP to Vaneé

      expect(xpCount(g.state.player1.groundArena[1])).toBe(0);
      expect(xpCount(g.state.player1.groundArena[0])).toBe(1);
    });
  });
});
