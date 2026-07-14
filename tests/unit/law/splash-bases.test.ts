import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// The 8 common LAW "splash" bases (LAW_020/021/022/024/025/027/028/030):
// "Epic Action: Play a card from your hand, ignoring 1 of its Vigilance, Command, Aggression,
//  or Cunning aspect penalties."
//
// Standard fixture: base Daimyo's Palace (Vigilance) + leader Sabine Wren (Aggression/Heroism).
// Aspects the player covers: { Vigilance, Aggression, Heroism }.
//
// Costs under that fixture (an uncovered icon = +2):
//   SOR_119 Reinforcement Walker  Command          cost 8 → 10 normally, 8 with splash
//   SOR_154 Rallying Cry          Aggression×2     cost 3 →  5 normally, 3 with splash
//                                 (one Aggression covered, one not — only ONE is ignored)
//   SOR_225 TIE/ln Fighter        Villainy         cost 1 →  3 normally, 3 with splash
//                                 (Villainy is a side aspect — never ignorable)
//   JTL_094 Luke Skywalker        Command/Heroism  cost 2 (pilot 3) → unit 4 / pilot 5 normally

const ALL_SPLASH_BASES = [
  Cards.bases.law.daimyosPalace,
  Cards.bases.law.coaxiumMine,
  Cards.bases.law.aldhaniGarrison,
  Cards.bases.law.imperialCommandComplex,
  Cards.bases.law.contestedCaverns,
  Cards.bases.law.stygeonSpire,
  Cards.bases.law.cantoBight,
  Cards.bases.law.partisanHideout,
];

function setup(handCardId: string, resources = 12, baseCardId = Cards.bases.law.daimyosPalace) {
  return new GameStateBuilder()
    .MyBase(baseCardId)
    .MyLeader(Cards.leaders.sor.sabineWren) // Aggression + Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resources)
    .WithCardInHandForPlayer(1, handCardId);
}

/** Ready resources remaining — how much was actually paid. */
function readyResources(g: GameTestAdapter): number {
  return g.state.player1.resources.filter(r => r.ready).length;
}

describe("LAW splash bases — Epic Action: play a card ignoring 1 aspect penalty", () => {
  describe("the discount", () => {
    it("ignores an uncovered Command penalty (Reinforcement Walker: 10 → 8)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(Cards.units.sor.reinforcementWalker).Build());

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.reinforcementWalker)).toBe(true);
      expect(readyResources(g)).toBe(12 - 8); // cost 8 + 2 penalty - 2 splash
    });

    it("plays the same card at full cost without the base (10)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(Cards.units.sor.reinforcementWalker).Build());

      await g.playCardFromHandAsync(1, 0); // normal play — no epic action

      expect(readyResources(g)).toBe(12 - 10); // the penalty is charged
    });

    it("ignores only ONE penalty of a doubled aspect (Rallying Cry: 5 → 3, not 1)", async () => {
      const g = new GameTestAdapter();
      const state = setup(Cards.events.sor.rallyingCry)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rallying Cry needs a unit
        .Build();
      g.loadNewState(state);

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      // Aggression x2: one covered by Sabine, one not → 1 penalty (2). Splash ignores it → cost 3.
      expect(readyResources(g)).toBe(12 - 3);
    });

    it("does NOT ignore a Villainy penalty — side aspects are never splashable", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(Cards.units.sor.tieLnFighter).Build());

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      // cost 1 + 2 (uncovered Villainy) = 3, no discount
      expect(readyResources(g)).toBe(12 - 3);
      expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.sor.tieLnFighter)).toBe(true);
    });

    it("gives no discount to a fully on-aspect card", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(Cards.units.sor.specForceSoldier).Build()); // Aggression/Heroism — both covered

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      expect(readyResources(g)).toBe(12 - 1); // cost 1, no penalty, no discount
    });
  });

  describe("card types", () => {
    it("can play an EVENT (not just units)", async () => {
      const g = new GameTestAdapter();
      const state = setup(Cards.events.sor.rallyingCry)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      expect(g.state.player1.hand).toHaveLength(0);
      expect(g.state.player1.discard.some(c => c.cardId === Cards.events.sor.rallyingCry)).toBe(true);
    });

    it("can play an UPGRADE, which still prompts for its attach target", async () => {
      const g = new GameTestAdapter();
      const state = setup(Cards.upgrades.sor.academyTraining) // Command — uncovered → discounted
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build();
      g.loadNewState(state);

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target"); // upgrade-target
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.groundArena[0].playId] });

      expect(g.state.player1.groundArena[0].upgrades).toHaveLength(1);
      expect(readyResources(g)).toBe(12 - 2); // cost 2 + 2 penalty - 2 splash
    });

    it("threads the discount through the Piloting choice", async () => {
      const g = new GameTestAdapter();
      const state = setup(Cards.units.jtl.lukeSkywalker) // Command/Heroism, cost 2, pilot cost 3
        .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker) // a Vehicle to pilot
        .Build();
      g.loadNewState(state);

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      // Both modes affordable → the unit-or-pilot prompt still appears.
      expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
      await g.chooseOptionAsync(1, "Play as Pilot");
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.groundArena[0].playId] });

      expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === Cards.units.jtl.lukeSkywalker)).toBe(true);
      expect(readyResources(g)).toBe(12 - 3); // pilot 3 + 2 penalty - 2 splash
    });
  });

  describe("epic action rules", () => {
    it("marks the base epic action used", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(Cards.units.sor.reinforcementWalker).Build());

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      expect(g.state.player1.base.epicActionUsed).toBe(true);
    });

    it("cannot be used twice", async () => {
      const g = new GameTestAdapter();
      const state = setup(Cards.units.sor.reinforcementWalker).Build();
      state.player1.base.epicActionUsed = true;
      g.loadNewState(state);

      await g.useBaseAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    });

    it("soft-passes with an empty hand", async () => {
      const g = new GameTestAdapter();
      const state = new GameStateBuilder()
        .MyBase(Cards.bases.law.daimyosPalace)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .Build();
      g.loadNewState(state);

      await g.useBaseAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    });

    it("soft-passes when nothing in hand is affordable even after the discount", async () => {
      const g = new GameTestAdapter();
      // Walker costs 8 (+2 penalty, -2 splash = 8); with only 3 resources it's unaffordable.
      g.loadNewState(setup(Cards.units.sor.reinforcementWalker, 3).Build());

      await g.useBaseAbilityAsync(1);

      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
      expect(g.state.player1.hand).toHaveLength(1); // still in hand
    });

    it("makes an otherwise-unaffordable card affordable (8 resources buys the 10-cost Walker)", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(Cards.units.sor.reinforcementWalker, 8).Build());

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.reinforcementWalker)).toBe(true);
      expect(readyResources(g)).toBe(0);
    });
  });

  describe("all 8 splash bases share the ability", () => {
    it.each(ALL_SPLASH_BASES)("%s discounts the uncovered Command penalty", async (baseCardId) => {
      const g = new GameTestAdapter();
      g.loadNewState(setup(Cards.units.sor.reinforcementWalker, 12, baseCardId).Build());

      await g.useBaseAbilityAsync(1);
      await g.chooseCardFromHandAsync(1, 0);

      expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.reinforcementWalker)).toBe(true);
      // Each base covers its own aspect, but none of them cover Command → always -2.
      expect(readyResources(g)).toBeLessThanOrEqual(12 - 8);
    });
  });
});
