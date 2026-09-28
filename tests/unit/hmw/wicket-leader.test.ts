import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_014 Wicket — Few Greater Battles to Fight (Leader, cost 4, 2/5 Ground)
// Front:  When a friendly unit attacks a unit that costs more than it: You may exhaust this
//         leader. If you do, draw a card.
//         Epic Action: If you control 4 or more resources, deploy this leader.
// Deployed: On Attack: If you control a unit that costs 3 or less, draw a card.

// Fixtures, all printed-text-free so nothing but Wicket can move the assertions:
//   Death Trooper Squad (ASH_242) — cost 4, 5/4 Ground — the attacker
//   Dinosaur Turtle     (ASH_131) — cost 6, 7/7 Ground — costs MORE than the attacker
//   Battlefield Marine  (SOR_095) — cost 2, 3/3 Ground — costs LESS
//   Ewok Brigade        (HMW_116) — cost 2, 2/4 Ground — the "costs 3 or less" friendly

describe("HMW_014 Wicket — front side", () => {
  /** P1 attacks with a cost-4 unit; `defender` is the single enemy ground unit. */
  function setup(defender: string, leaderReady = true) {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.hmw.wicket, leaderReady)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.ash.deathTrooperSquad) // cost 4 attacker
      .WithGroundUnitForPlayer(2, defender)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    return g;
  }

  it("may exhaust the leader to draw a card when the defender costs more (accept)", async () => {
    const g = setup(Cards.units.ash.dinosaurTurtle); // cost 6 > 4

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("may decline — no draw, and the leader stays ready", async () => {
    const g = setup(Cards.units.ash.dinosaurTurtle);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(1);
    expect(g.state.player1.leader.ready).toBe(true);
    // Declining leaves the leader ready, so the second consultation would re-offer if the
    // asked-already marker were missing — and the attack would hang instead of resolving.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(5);
  });

  it("the attack still resolves after accepting", async () => {
    const g = setup(Cards.units.ash.dinosaurTurtle);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    // 5 power into a 7/7 Turtle, 7 back into a 5/4 Squad: the attacker dies, the Turtle lives.
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(5);
  });

  it("does not trigger when the defender costs the same as the attacker", async () => {
    const g = setup(Cards.units.ash.deathTrooperSquad); // cost 4 === 4

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("does not trigger when the defender costs less than the attacker", async () => {
    const g = setup(Cards.units.sor.battlefieldMarine); // cost 2 < 4

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("does not trigger when attacking the enemy base", async () => {
    const g = setup(Cards.units.ash.dinosaurTurtle);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("does not trigger when the OPPONENT attacks a costlier unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.hmw.wicket)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithActivePlayer(2)
      .WithGroundUnitForPlayer(1, Cards.units.ash.dinosaurTurtle) // cost 6 defender
      .WithGroundUnitForPlayer(2, Cards.units.ash.deathTrooperSquad) // cost 4 attacker
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("still triggers when the attacker has its own On Attack ability", async () => {
    // An attacker with an On Attack reaches combat by a different route than a plain one (its
    // trigger resolves first, and the attack is handed off from there). Wicket has to be consulted
    // on both routes, and this is the one a plain-attacker test never exercises.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.hmw.wicket)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      // Emperor's Messenger: cost 1, "On Attack: Ready a resource" — automatic and targetless.
      .WithGroundUnitForPlayer(1, Cards.units.ash.emperorsMessenger)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // cost 2 > 1
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1, false) // exhausted
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand).toHaveLength(1); // Wicket's draw
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.resources[0].ready).toBe(true); // the attacker's own On Attack also ran
  });

  it("asks only once per attack", async () => {
    // The offer is consulted at both hand-offs to combat; answering it must not re-ask.
    const g = setup(Cards.units.ash.dinosaurTurtle);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(1); // one card, not two
  });

  it("does not trigger when the leader is already exhausted", async () => {
    const g = setup(Cards.units.ash.dinosaurTurtle, false);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(0);
  });

  // The two Epic Action cases below guard the 4-resource threshold, but note they do not isolate
  // the epic-condition branch: Wicket's printed deploy cost is also 4, and the generic deploy path
  // gates on that same number. The registry entry still matters — it makes the gate a condition, so
  // it stays at 4 even if something modifies his cost — but no fixture here distinguishes the two.
  it("Epic Action: deploys when you control 4 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.hmw.wicket)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(4); // condition, not a cost
  });

  it("Epic Action: does not deploy with fewer than 4 resources", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.hmw.wicket)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("HMW_014 Wicket — deployed side", () => {
  /** Deploys Wicket, then hands the turn back to P1 so he can attack. */
  async function deployed(extraFriendly: string | null, deckCards: string[] = []) {
    const g = new GameTestAdapter();
    let builder = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.hmw.wicket)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4);
    if (extraFriendly) builder = builder.WithGroundUnitForPlayer(1, extraFriendly);
    for (const c of deckCards) builder = builder.WithCardInDeckForPlayer(1, c);
    g.loadNewState(builder.Build());

    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1; // deploying handed the turn to the opponent

    const wicketIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.leaders.hmw.wicket);
    await g.dispatchAsync(1, "initiate-attack", { playId: g.state.player1.groundArena[wicketIdx].playId });
    return g;
  }

  it("On Attack: draws when you control a unit that costs 3 or less", async () => {
    const g = await deployed(Cards.units.hmw.ewokBrigade, [Cards.units.sor.battlefieldMarine]);

    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.deck).toHaveLength(0);
  });

  it("On Attack: does not draw when no friendly unit costs 3 or less", async () => {
    // Wicket himself costs 4, and the Death Trooper Squad costs 4 — nothing qualifies.
    const g = await deployed(Cards.units.ash.deathTrooperSquad, [Cards.units.sor.battlefieldMarine]);

    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(1);
  });

  it("On Attack: an empty deck takes 3 base damage instead of the draw", async () => {
    const g = await deployed(Cards.units.hmw.ewokBrigade, []); // no deck

    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(3);
  });

  it("the front-side reaction is gone once deployed", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.hmw.wicket, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.leaders.hmw.wicket) // the deployed leader unit
      .WithGroundUnitForPlayer(1, Cards.units.ash.deathTrooperSquad) // cost 4, no On Attack
      .WithGroundUnitForPlayer(2, Cards.units.ash.dinosaurTurtle) // cost 6 — would trigger the front side
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 1); // the Squad attacks, not Wicket
    await g.chooseGroundUnitAsync(2, 0);

    // A deployed Wicket reads only his unit side, and that side has no such reaction. The
    // Squad is not Wicket, so his On Attack does not fire either.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(0);
  });
});
