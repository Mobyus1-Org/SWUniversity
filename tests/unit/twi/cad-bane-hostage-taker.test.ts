import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_187 Cad Bane — Hostage Taker (7/7 Ground, cost 7, Underworld/Bounty Hunter, unique) —
//   "When Played: This unit captures up to 3 enemy non-leader units with a total of 8 or less
//    remaining HP."
//   "On Attack: The defending player may rescue a card they own guarded by this unit. If they do,
//    draw 2 cards."
//
// The capture shares ASH_053's budget-select, with a count cap as well as an HP budget. As there,
// the budget is over REMAINING HP, so a damaged unit costs less than its printed HP.
//
// Two things that read the wrong way round:
//   - "enemy" means units the opponent CONTROLS, not units they own. A unit they took control of
//     is a legal capture even though its owner is the Cad Bane player.
//   - "If they do, draw 2 cards" — the DEFENDER chooses to rescue, but CAD BANE'S CONTROLLER
//     draws the two cards. The rescuing player gets their unit back, not the cards.

const CAD_BANE = "TWI_187";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7
const BIG = Cards.units.ash.dinosaurTurtle;         // 7/7
const SPACER = "SHD_063";                           // System Patrol Craft, 3/4 Space

function setup() {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, CAD_BANE)
    .WithActivePlayer(1);
  for (let i = 0; i < 6; i++) b = b.WithCardInDeckForPlayer(1, MARINE);
  return b;
}

const bane = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === CAD_BANE)!;

describe("TWI_187 Cad Bane — Hostage Taker", () => {
  describe("When Played: capture within the budget", () => {
    it("captures two enemy units inside the 8 HP budget", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(2, MARINE)  // 3
          .WithGroundUnitForPlayer(2, MARINE)  // 3  -> 6 total
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      const ids = g.state.player2.groundArena.map(u => u.playId);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

      expect(g.state.player2.groundArena).toHaveLength(0);
      expect(bane(g).captives).toHaveLength(2);
    });

    it("counts REMAINING HP, so a damaged 7/7 fits", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, BIG, true, 5).Build()); // 2 remaining

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

      expect(bane(g).captives).toHaveLength(1);
    });

    it("rejects a selection over the 8 HP budget", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(2, CSF)   // 7
          .WithGroundUnitForPlayer(2, MARINE) // 3 -> 10 > 8
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);
      const ids = g.state.player2.groundArena.map(u => u.playId);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

      expect(g.state.player2.groundArena).toHaveLength(2);
      expect(bane(g).captives ?? []).toHaveLength(0);
    });

    it("rejects more than 3 units even when they fit the budget", async () => {
      const g = new GameTestAdapter();
      let b = setup();
      for (let i = 0; i < 4; i++) b = b.WithGroundUnitForPlayer(2, "SHD_040"); // 1/2 each = 8 total
      g.loadNewState(b.Build());

      await g.playCardFromHandAsync(1, 0);
      const ids = g.state.player2.groundArena.map(u => u.playId);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

      expect(g.state.player2.groundArena).toHaveLength(4); // nothing captured
    });

    it("reaches SPACE units too — 'enemy non-leader units' names no arena", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithSpaceUnitForPlayer(2, SPACER).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });

      expect(bane(g).captives).toHaveLength(1);
    });

    it("does not offer FRIENDLY units", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup()
          .WithGroundUnitForPlayer(1, MARINE)
          .WithGroundUnitForPlayer(2, MARINE)
          .Build(),
      );

      await g.playCardFromHandAsync(1, 0);

      const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
      const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
      expect(offered).toEqual([g.state.player2.groundArena[0].playId]);
    });

    it("can capture nothing", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] });

      expect(g.state.player2.groundArena).toHaveLength(1);
      expect(bane(g).captives ?? []).toHaveLength(0);
    });
  });

  describe("On Attack: the defender may rescue", () => {
    async function captureOne() {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());
      await g.playCardFromHandAsync(1, 0);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
      await g.dispatchAsync(2, "pass-action", {});
      // He entered play exhausted this turn; the On Attack is what is under test, not readying.
      g.state.player1.groundArena.find(u => u.cardId === CAD_BANE)!.ready = true;
      return g;
    }

    it("lets the DEFENDER rescue, and CAD BANE'S controller draws 2", async () => {
      const g = await captureOne();
      const myHandBefore = g.state.player1.hand.length;
      const theirHandBefore = g.state.player2.hand.length;

      const idx = g.state.player1.groundArena.findIndex(u => u.cardId === CAD_BANE);
      await g.attackWithGroundUnitAsync(1, idx);
      await g.chooseBaseAsync(1, 2);
      await g.chooseYesAsync(2); // the DEFENDING player answers

      expect(g.state.player2.groundArena.some(u => u.cardId === MARINE)).toBe(true); // rescued
      expect(g.state.player1.hand.length).toBe(myHandBefore + 2); // the attacker draws
      expect(g.state.player2.hand.length).toBe(theirHandBefore);  // the rescuer does not
    });

    it("declining leaves the captive and draws nobody anything", async () => {
      const g = await captureOne();
      const myHandBefore = g.state.player1.hand.length;

      const idx = g.state.player1.groundArena.findIndex(u => u.cardId === CAD_BANE);
      await g.attackWithGroundUnitAsync(1, idx);
      await g.chooseBaseAsync(1, 2);
      await g.chooseNoAsync(2);

      expect(bane(g).captives).toHaveLength(1);
      expect(g.state.player1.hand.length).toBe(myHandBefore);
    });

    it("asks nothing when he is guarding no captives", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, CAD_BANE).Build());

      const idx = g.state.player1.groundArena.findIndex(u => u.cardId === CAD_BANE);
      await g.attackWithGroundUnitAsync(1, idx);
      await g.chooseBaseAsync(1, 2);

      expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    });
  });
});
