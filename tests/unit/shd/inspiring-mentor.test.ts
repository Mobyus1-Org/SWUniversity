import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_104 Inspiring Mentor (Upgrade, cost 2, Command/Heroism) and its IC27_085 reprint
//   "Attach to a non-Vehicle unit. Attached unit gains: 'On Attack/When Defeated: Give an
//    Experience token to another friendly unit.'"
// Mandatory both times. "Another" excludes the host.

const MARINE = Cards.units.sor.battlefieldMarine;        // 3/3, 4/4 with the Mentor's +1/+1
const SECURITY = Cards.units.sor.consularSecurityForce;  // 3/7 — the other friendly unit
const XP = Cards.upgrades.token.experience;

function board(mentor: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(mentor, 1)]);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? res.fromPlayIds : undefined;
};
const xpOn = (g: GameTestAdapter, cardId: string) =>
  g.state.player1.groundArena.find(u => u.cardId === cardId)!.upgrades.filter(u => u.cardId === XP).length;

for (const [label, MENTOR] of [
  ["SHD_104", Cards.upgrades.shd.inspiringMentor],
  ["IC27_085", Cards.upgrades.ic27.inspiringMentor],
] as const) {
  describe(`${label} Inspiring Mentor`, () => {
    it("attaches only to a non-Vehicle unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        board(MENTOR)
          .WithSpaceUnitForPlayer(1, Cards.units.jtl.phoenixSquadronAWing) // a Vehicle
          .WithCardInHandForPlayer(1, MENTOR)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      expect(offered(g)).toContain(g.state.player1.groundArena[0].playId);
      expect(offered(g)).not.toContain(g.state.player1.spaceArena[0].playId);
    });

    it("On Attack: gives Experience to ANOTHER friendly unit, then the attack lands", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(MENTOR).WithGroundUnitForPlayer(1, SECURITY).Build());
      const security = g.state.player1.groundArena[1].playId;

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);
      expect(offered(g)).toEqual([security]); // the host is not "another"
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [security] });

      expect(xpOn(g, SECURITY)).toBe(1);
      expect(xpOn(g, MARINE)).toBe(0);
      expect(g.state.player2.base.damage).toBe(4);
    });

    it("control: with no other friendly unit, the attack goes straight through", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(MENTOR).Build());

      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseBaseAsync(1, 2);

      expect(g.state.player2.base.damage).toBe(4);
    });

    it("When Defeated: gives Experience to another friendly unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        board(MENTOR)
          .WithGroundUnitForPlayer(1, SECURITY)
          .WithCardInHandForPlayer(1, Cards.events.twi.lethalCrackdown)
          .Build(),
      );
      const host = g.state.player1.groundArena[0].playId;
      const security = g.state.player1.groundArena[1].playId;

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [host] }); // defeat the host
      expect(offered(g)).toEqual([security]);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [security] });

      expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([SECURITY]);
      expect(xpOn(g, SECURITY)).toBe(1);
    });
  });
}
