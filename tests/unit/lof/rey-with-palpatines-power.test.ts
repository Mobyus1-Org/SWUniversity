import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_148 Rey — With Palpatine's Power (5/5 Ground) — "When you draw this card during the action
// phase: If you control a Aggression leader or base, you may reveal this card from your hand. If
// you do, deal 2 damage to a unit and 2 damage to a base."
//
// Three gates, all separately testable:
//   1. the draw must happen DURING THE ACTION PHASE (the regroup draw does not count),
//   2. you must control an Aggression leader OR an Aggression base — either alone suffices,
//   3. the reveal is a "may" — declining must cost nothing and leave Rey in hand.
//
// Forced Surrender (SOR_175, "Draw 2 cards") is the draw engine here: with no opponent base
// damaged this phase it adds no prompt of its own, so the only pending is Rey's.

const REY = Cards.units.lof.rey;
const MARINE = Cards.units.sor.battlefieldMarine;
const AGGRESSION_BASE = Cards.bases.common.red30HP;    // SOR_026 — Aggression
const PLAIN_BASE = Cards.bases.common.green30HP;       // SOR_023 — Command
const AGGRESSION_LEADER = Cards.leaders.sor.sabineWren; // SOR_014 — Aggression/Heroism
const PLAIN_LEADER = Cards.leaders.sor.lukeSkywalker;   // SOR_005 — Vigilance/Heroism

function setup(opts: { base?: string; leader?: string } = {}) {
  return new GameStateBuilder()
    .MyBase(opts.base ?? AGGRESSION_BASE)
    .MyLeader(opts.leader ?? PLAIN_LEADER)
    .TheirBase(PLAIN_BASE)
    .TheirLeader(PLAIN_LEADER)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives 2 damage
    .WithCardInHandForPlayer(1, Cards.events.sor.forcedSurrender)
    // Deck draws from the END, so the LAST card added is drawn first.
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, REY);
}

describe("LOF_148 Rey — With Palpatine's Power", () => {
  it("offers the reveal when drawn in the action phase with an Aggression base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0); // Forced Surrender draws Rey
    expect(g.state.player1.hand.some(c => c.cardId === REY)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // 2 damage to a unit
    await g.chooseBaseAsync(1, 2);       // 2 damage to a base

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("also triggers off an Aggression LEADER with a non-Aggression base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ base: PLAIN_BASE, leader: AGGRESSION_LEADER }).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
  });

  it("does NOT trigger without an Aggression leader or base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup({ base: PLAIN_BASE, leader: PLAIN_LEADER }).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.hand.some(c => c.cardId === REY)).toBe(true); // drawn
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();    // but silent
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("can be declined — Rey stays in hand and nothing is damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.some(c => c.cardId === REY)).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("can aim the 2 damage at its own side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // friendly Marine
    await g.chooseBaseAsync(1, 1);       // own base

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(2);
  });

  // "If you control a Aggression leader or base" — every way that condition can be satisfied.
  // A leader deployed as a Pilot turns its HOST into the leader unit, so the host's aspects
  // count as well as the leader card's own.
  describe("what counts as controlling Aggression", () => {
    const KAZUDA = Cards.leaders.jtl.kazudaXiono;     // Cunning/Heroism — NOT Aggression
    const RED_SHIP = Cards.units.sec.contrabandStarhopper; // Aggression Vehicle

    it("1. an Aggression base", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup({ base: AGGRESSION_BASE, leader: PLAIN_LEADER }).Build());
      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    });

    it("2. an Aggression leader, undeployed", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(setup({ base: PLAIN_BASE, leader: AGGRESSION_LEADER }).Build());
      expect(g.state.player1.leader.deployed).toBe(false);
      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    });

    it("3. an Aggression leader deployed as a ground unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup({ base: PLAIN_BASE, leader: PLAIN_LEADER })
          .MyLeader(AGGRESSION_LEADER, true, true)
          .WithGroundUnitForPlayer(1, AGGRESSION_LEADER) // the deployed leader unit
          .Build(),
      );
      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    });

    it("4. an Aggression leader deployed as a Pilot on a NON-Aggression ship", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup({ base: PLAIN_BASE, leader: PLAIN_LEADER })
          .MyLeader(AGGRESSION_LEADER, true, true)
          .WithSpaceUnitForPlayer(1, Cards.units.jtl.phoenixSquadronAWing) // Heroism ship
          .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
            GameStateBuilder.Upgrade(AGGRESSION_LEADER, 1),
          ])
          .Build(),
      );
      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    });

    it("5. a NON-Aggression leader piloting an Aggression ship — the host is the leader unit", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup({ base: PLAIN_BASE, leader: PLAIN_LEADER })
          .MyLeader(KAZUDA, true, true)
          .WithSpaceUnitForPlayer(1, RED_SHIP)
          .WithUpgradesOnSpaceUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(KAZUDA, 1)])
          .Build(),
      );
      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    });

    it("control: an Aggression ship with NO leader piloting it does not count", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        setup({ base: PLAIN_BASE, leader: PLAIN_LEADER })
          .WithSpaceUnitForPlayer(1, RED_SHIP) // red, but just a unit — not a leader unit
          .Build(),
      );
      await g.playCardFromHandAsync(1, 0);
      expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    });
  });

  it("triggers off a deck-search draw such as Recruit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(AGGRESSION_BASE)
        .MyLeader(PLAIN_LEADER)
        .TheirBase(PLAIN_BASE)
        .TheirLeader(PLAIN_LEADER)
        .FillResourcesForPlayer(1, MARINE, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithCardInHandForPlayer(1, Cards.events.sor.recruit)
        .WithCardInDeckForPlayer(1, REY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    // Recruit searches the top 5 for a unit and draws it — pick Rey out of the search choices.
    const search = g.lastDispatchResponse?.resolutionNeeded as unknown as
      { choices?: { tempId: string; cardId: string }[] };
    const reyChoice = search.choices?.find(c => c.cardId === REY);
    expect(reyChoice).toBeDefined();
    await g.chooseDeckSearchAsync(1, [reyChoice!.tempId]);

    expect(g.state.player1.hand.some(c => c.cardId === REY)).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined(); // Rey's reveal is offered
  });

  it("does NOT trigger on the regroup-phase draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(AGGRESSION_BASE)
        .MyLeader(AGGRESSION_LEADER)
        .TheirBase(PLAIN_BASE)
        .TheirLeader(PLAIN_LEADER)
        .FillResourcesForPlayer(1, MARINE, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, REY)
        .Build(),
    );

    // Both players pass — the action phase ends and the regroup draw happens.
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.gamePhase).not.toBe("ActionPhase");
    expect(g.state.player1.hand.some(c => c.cardId === REY)).toBe(true); // it was drawn
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();    // but no reveal offered
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
