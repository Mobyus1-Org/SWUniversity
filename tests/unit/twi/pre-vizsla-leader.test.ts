import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// TWI_010 Pre Vizsla — Pursuing the Throne (Leader; deployed 4/6 Ground, Mandalorian/Trooper)
//   Leader side: "Action [1 resource, Exhaust]: Deal damage to a unit equal to the number of
//                 cards you've drawn this phase. (This doesn't include cards drawn in the
//                 regroup phase.)"
//                "Epic Action: If you control 5 or more resources, deploy this leader."
//   Deployed:    "While you have 3 or more cards in your hand, this unit gains Saboteur."
//                "While you have 6 or more cards in your hand, this unit gets +2/+0."
//
// The Action's target is unqualified — "a unit" — so friendly units are legal targets too
// (contrast TWI_013 Mace Windu, which says "damaged ENEMY unit"). There is no "if" clause on the
// draw count either: with nothing drawn the Action is still usable and simply deals 0.

const VIZSLA = Cards.leaders.twi.preVizsla;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 Ground — soaks the damage visibly
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP) // Aggression — covers Pre Vizsla's own aspect cheaply
    .MyLeader(VIZSLA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

/** The engine's own counter, seeded the way TWI_014's tests seed cardsPlayedThisPhase. */
function seedDraws(g: GameTestAdapter, player: 1 | 2, count: number) {
  g.state.roundState.cardsDrawnThisPhase[player] = count;
}

describe("TWI_010 Pre Vizsla", () => {
  describe("leader side — Action [1 resource, Exhaust]", () => {
    it("deals damage equal to the cards drawn this phase", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());
      seedDraws(g, 1, 2);

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(2);
    });

    it("counts draws that really happened this phase", async () => {
      // End-to-end: Mission Briefing draws 2, and those draws feed the same counter.
      const g = new GameTestAdapter();
      const state = setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithCardInHandForPlayer(1, Cards.events.sor.missionBriefing) // Aggression, cost 3
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, MARINE)
        .Build();
      g.loadNewState(state);

      await g.playCardFromHandAsync(1, 0);
      await g.chooseYesAsync(1);            // Yes = the playing player draws 2
      await g.dispatchAsync(2, "pass-action", {});
      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(2);
    });

    it("deals 0 with nothing drawn this phase, and still pays its cost", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(0);
      expect(g.state.player1.leader.ready).toBe(false);
      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1);
    });

    it("can target a FRIENDLY unit — the text says 'a unit', unqualified", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(1, CSF).Build());
      seedDraws(g, 1, 3);

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(1, 0);

      expect(g.state.player1.groundArena[0].damage).toBe(3);
    });

    it("costs 1 resource and exhausts the leader", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());
      seedDraws(g, 1, 1);

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player1.leader.ready).toBe(false);
      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1);
    });

    it("defeats a unit the damage finishes off", async () => {
      const g = new GameTestAdapter();
      // Battlefield Marine is 3/3; 3 draws is exactly lethal.
      g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());
      seedDraws(g, 1, 3);

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena).toHaveLength(0);
    });

    it("is unavailable with no unit in play", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().Build());
      seedDraws(g, 1, 2);

      await g.useLeaderAbilityAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.ready).toBe(true);
    });

    it("counts only YOUR draws, not the opponent's", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());
      seedDraws(g, 2, 4); // the opponent drew, you did not

      await g.useLeaderAbilityAsync(1);
      await g.chooseGroundUnitAsync(2, 0);

      expect(g.state.player2.groundArena[0].damage).toBe(0);
    });
  });

  describe("Epic Action — deploy at 5 or more resources", () => {
    function withResources(count: number) {
      return new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(VIZSLA)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, count)
        .WithActivePlayer(1);
    }

    it("deploys while controlling 5 resources, spending none of them", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(withResources(5).Build());

      await g.deployLeaderAsync(1);

      expect(g.state.player1.leader.deployed).toBe(true);
      expect(g.state.player1.groundArena.some(u => u.cardId === VIZSLA)).toBe(true);
      expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(0);
    });

    it("cannot deploy on 4 resources", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(withResources(4).Build());

      await g.deployLeaderAsync(1);

      expect(g.lastDispatchResponse?.invalidAction).toBe(true);
      expect(g.state.player1.leader.deployed).toBe(false);
    });
  });

  describe("deployed side — hand-size thresholds", () => {
    const vizslaUnit = (g: GameTestAdapter) =>
      Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === VIZSLA)!);

    /** Deploys Pre Vizsla with exactly `handSize` cards in hand. */
    async function deployedWithHand(handSize: number): Promise<GameTestAdapter> {
      const g = new GameTestAdapter();
      let builder = setup();
      for (let i = 0; i < handSize; i++) builder = builder.WithCardInHandForPlayer(1, MARINE);
      g.loadNewState(builder.Build());

      await g.deployLeaderAsync(1); // Epic Action — needs 5+ resources, we have 14
      return g;
    }

    it("gains Saboteur while you have 3 or more cards in hand", async () => {
      const g = await deployedWithHand(3);
      const vizsla = vizslaUnit(g);

      expect(HasSaboteur(vizsla.cardId, vizsla.playId, 1)).toBe(true);
    });

    it("control: with only 2 cards in hand it has no Saboteur", async () => {
      const g = await deployedWithHand(2);
      const vizsla = vizslaUnit(g);

      expect(HasSaboteur(vizsla.cardId, vizsla.playId, 1)).toBe(false);
    });

    it("gets +2/+0 while you have 6 or more cards in hand", async () => {
      const g = await deployedWithHand(6);

      expect(vizslaUnit(g).CurrentPower()).toBe(6); // 4 + 2
      expect(vizslaUnit(g).TotalHP()).toBe(6);      // power-only — HP is untouched
    });

    it("control: with only 5 cards in hand it stays 4/6", async () => {
      const g = await deployedWithHand(5);

      expect(vizslaUnit(g).CurrentPower()).toBe(4);
      expect(vizslaUnit(g).TotalHP()).toBe(6);
    });

    it("the two thresholds are independent — 3 cards is Saboteur but no +2/+0", async () => {
      const g = await deployedWithHand(3);
      const vizsla = vizslaUnit(g);

      expect(HasSaboteur(vizsla.cardId, vizsla.playId, 1)).toBe(true);
      expect(vizsla.CurrentPower()).toBe(4);
    });
  });
});
