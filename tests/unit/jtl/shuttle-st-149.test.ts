import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_242 Shuttle ST-149 — 3/4 Space, cost 4. Shielded.
// "When Played/When Defeated: You may take control of a token upgrade on a unit
//  and attach it to a different eligible unit."

const xpCount = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(up => up.cardId === Cards.upgrades.token.experience).length;

describe("JTL_242 Shuttle ST-149", () => {
  describe("When Played", () => {
    it("Yes: moves a token upgrade to a different eligible unit", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.infernoFour)        // [0] holder
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1),
        ])
        .WithSpaceUnitForPlayer(1, Cards.units.sor.piratedStarfighter) // [1] destination
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithCardInHandForPlayer(1, Cards.units.jtl.shuttleSt149)
        .WithActivePlayer(1)
        .Build();
      g.loadNewState(state);
      const holderPlayId = g.state.player1.spaceArena[0].playId;
      const xpPlayId = g.state.player1.spaceArena[0].upgrades[0].playId;
      const destPlayId = g.state.player1.spaceArena[1].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1); // take-control When Played option
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [xpPlayId] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [destPlayId] });

      const holder = [...g.state.player1.spaceArena].find(u => u.playId === holderPlayId)!;
      const dest = [...g.state.player1.spaceArena].find(u => u.playId === destPlayId)!;
      expect(xpCount(holder)).toBe(0);
      expect(xpCount(dest)).toBe(1);
    });

    it("Shielded: gains a Shield token when played", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
        .WithCardInHandForPlayer(1, Cards.units.jtl.shuttleSt149)
        .WithActivePlayer(1)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      // Shielded + When Played both queue → trigger-order. Resolve When Played first (no token to move),
      // then Shielded gives the Shield token.
      await g.chooseOptionAsync(1, "Shuttle ST-149 — When Played");

      const shuttle = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.jtl.shuttleSt149)!;
      expect(shuttle.upgrades.some(u => u.cardId === Cards.upgrades.token.shield)).toBe(true);
    });
  });

  describe("When Defeated", () => {
    // Helper: build a board where a pre-damaged Shuttle is about to be defeated by an enemy attacker.
    const buildBoard = (holderUpgrade: string | null) => {
      const b = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.shuttleSt149, true, 3)   // [0] pre-damaged 3 of 4 HP
        .WithSpaceUnitForPlayer(1, Cards.units.sor.infernoFour)             // [1] holder
        .WithSpaceUnitForPlayer(1, Cards.units.sor.piratedStarfighter)      // [2] destination
        .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)       // enemy attacker (3 power, survives)
        .WithActivePlayer(2);
      if (holderUpgrade) {
        b.WithUpgradesOnSpaceUnitForPlayer(1, 1, [GameStateBuilder.Upgrade(holderUpgrade, 1)]);
      }
      return b.Build();
    };

    it("offers a Yes/No choice when a token upgrade is in play", async () => {
      const g = new GameTestAdapter();
      const state = buildBoard(Cards.upgrades.token.experience);
      g.loadNewState(state);
      const shuttlePlayId = g.state.player1.spaceArena[0].playId;

      await g.attackWithSpaceUnitAsync(2, 0);
      await g.dispatchAsync(2, "choose-target", { targetPlayIds: [shuttlePlayId] });

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    });

    it("Yes: moves a token upgrade to a different eligible unit", async () => {
      const g = new GameTestAdapter();
      const state = buildBoard(Cards.upgrades.token.experience);
      g.loadNewState(state);
      const shuttlePlayId = g.state.player1.spaceArena[0].playId;
      const holderPlayId = g.state.player1.spaceArena[1].playId;
      const xpPlayId = g.state.player1.spaceArena[1].upgrades[0].playId;
      const destPlayId = g.state.player1.spaceArena[2].playId;

      await g.attackWithSpaceUnitAsync(2, 0);
      await g.dispatchAsync(2, "choose-target", { targetPlayIds: [shuttlePlayId] });
      await g.chooseYesAsync(1);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [xpPlayId] });
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [destPlayId] });

      const holder = [...g.state.player1.spaceArena].find(u => u.playId === holderPlayId)!;
      const dest = [...g.state.player1.spaceArena].find(u => u.playId === destPlayId)!;
      expect(xpCount(holder)).toBe(0);
      expect(xpCount(dest)).toBe(1);
    });

    it("No: leaves the token upgrade where it is", async () => {
      const g = new GameTestAdapter();
      const state = buildBoard(Cards.upgrades.token.experience);
      g.loadNewState(state);
      const shuttlePlayId = g.state.player1.spaceArena[0].playId;
      const holderPlayId = g.state.player1.spaceArena[1].playId;

      await g.attackWithSpaceUnitAsync(2, 0);
      await g.dispatchAsync(2, "choose-target", { targetPlayIds: [shuttlePlayId] });
      await g.chooseNoAsync(1);

      const holder = [...g.state.player1.spaceArena].find(u => u.playId === holderPlayId)!;
      expect(xpCount(holder)).toBe(1);
    });

    it("does not prompt when only a non-token upgrade is in play", async () => {
      const g = new GameTestAdapter();
      const state = buildBoard(Cards.upgrades.sor.academyTraining); // regular upgrade, not a token
      g.loadNewState(state);
      const shuttlePlayId = g.state.player1.spaceArena[0].playId;

      await g.attackWithSpaceUnitAsync(2, 0);
      await g.dispatchAsync(2, "choose-target", { targetPlayIds: [shuttlePlayId] });

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).not.toBe("Option");
    });
  });
});
