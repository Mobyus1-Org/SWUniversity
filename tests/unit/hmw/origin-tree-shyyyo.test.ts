import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// HMW_145 Origin Tree Shyyyo — Unit, Ground, cost 6, 4/8, Command, Creature, non-unique.
//   "Restore 1
//    While you control a Kashyyyk base, the first, second, and third units you play each round
//    cost 1 less, 2 less, and 3 less, respectively."
//
// The ladder is read off `cardsPlayedThisRound`, which already tags each play as Unit / Event /
// Upgrade / Pilot — so only unit plays advance it.
//
// Two rulings shape the edges, and both fall out of reading "while you control" as a live board
// check rather than a property of the card:
//   1. Shyyyo never discounts HIMSELF (his cost is computed while he is still in hand) but he DOES
//      count as a unit played, so the next unit is the second rung.
//   2. A unit played before him gets nothing, and he is then the second unit played.
//
// Costs are asserted through resources remaining: the price IS the observable behaviour here, and
// every expected total below is chosen so a wrong rung leaves a different number.

const SHYYYO = "HMW_145";
const KACHIRHO = "HMW_021";          // Kashyyyk base
const CHEAP = Cards.units.sor.battlefieldMarine;   // SOR_095, cost 2
const MID = "IBH_008";                              // Crix Madine, cost 3
const EVENT = "SOR_251";                            // Confiscate, cost 1 — fizzles harmlessly

/** Kachirho is Vigilance; the leader covers Command+Heroism, so nothing here pays a penalty. */
function board(resources: number, base = KACHIRHO) {
  return new GameStateBuilder()
    .MyBase(base)
    .MyLeader(Cards.leaders.twi.captainRex) // Command/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, CHEAP, resources)
    .WithActivePlayer(1);
}

const readyResources = (g: GameTestAdapter) =>
  g.state.player1.resources.filter(r => r.ready).length;

/** P1 acts, P2 passes — a player cannot take two actions in a row. */
async function play(g: GameTestAdapter, handIndex = 0) {
  await g.playCardFromHandAsync(1, handIndex);
  await g.dispatchAsync(2, "pass-action", {});
}

describe("HMW_145 Origin Tree Shyyyo", () => {
  it("has Restore 1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).Build());

    expect(RestoreAmount(SHYYYO)).toBe(1);
  });

  describe("the ladder", () => {
    it("escalates 1 / 2 / 3 across a round", async () => {
      // Three cost-3 units cost 2, then 1, then 0 — three resources, not nine.
      const g = new GameTestAdapter();
      g.loadNewState(
        board(3)
          .WithGroundUnitForPlayer(1, SHYYYO)
          .WithCardInHandForPlayer(1, MID)
          .WithCardInHandForPlayer(1, MID)
          .WithCardInHandForPlayer(1, MID)
          .Build(),
      );

      await play(g); expect(readyResources(g)).toBe(1); // 3 - 2
      await play(g); expect(readyResources(g)).toBe(0); // 1 - 1
      await play(g); expect(readyResources(g)).toBe(0); // free
      expect(g.state.player1.hand).toHaveLength(0);
    });

    it("ends at three — the fourth unit pays full price", async () => {
      const g = new GameTestAdapter();
      let b = board(6).WithGroundUnitForPlayer(1, SHYYYO);
      for (let i = 0; i < 4; i++) b = b.WithCardInHandForPlayer(1, MID);
      g.loadNewState(b.Build());

      await play(g); await play(g); await play(g); // 2 + 1 + 0 = 3 spent
      expect(readyResources(g)).toBe(3);
      await play(g);                                // full 3

      expect(readyResources(g)).toBe(0);
      expect(g.state.player1.hand).toHaveLength(0);
    });

    it("floors at zero rather than going negative", async () => {
      // The third rung is -3 against a cost-2 unit: free, not -1.
      const g = new GameTestAdapter();
      g.loadNewState(
        board(3)
          .WithGroundUnitForPlayer(1, SHYYYO)
          .WithCardInHandForPlayer(1, MID)
          .WithCardInHandForPlayer(1, MID)
          .WithCardInHandForPlayer(1, CHEAP)
          .Build(),
      );

      await play(g); await play(g); await play(g);

      expect(readyResources(g)).toBe(0);
      expect(g.state.player1.groundArena.some(u => u.cardId === CHEAP)).toBe(true);
    });
  });

  describe("rulings — Shyyyo and himself", () => {
    it("counts as the first unit played but discounts nobody, including himself", async () => {
      // 6 resources: Shyyyo costs the full 6 (he is still in hand, so nothing is in play to
      // discount him), leaving 0 — but the ladder has advanced, so the cost-2 unit is the SECOND
      // (-2, free) and the cost-3 unit is the THIRD (-3, free).
      const g = new GameTestAdapter();
      g.loadNewState(
        board(6)
          .WithCardInHandForPlayer(1, SHYYYO)
          .WithCardInHandForPlayer(1, CHEAP)
          .WithCardInHandForPlayer(1, MID)
          .Build(),
      );

      await play(g); await play(g); await play(g);

      expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([SHYYYO, CHEAP, MID]);
      expect(readyResources(g)).toBe(0);
      expect(g.state.player1.hand).toHaveLength(0);
    });

    it("a unit played BEFORE him gets nothing, and only the third unit is discounted", async () => {
      // 8 resources: CHEAP costs 2 (no Shyyyo yet) → 6; Shyyyo costs 6 → 0; MID is the THIRD unit
      // at -3 → free. Discriminating: if he discounted himself as the second unit he would cost 4
      // and two resources would survive.
      const g = new GameTestAdapter();
      g.loadNewState(
        board(8)
          .WithCardInHandForPlayer(1, CHEAP)
          .WithCardInHandForPlayer(1, SHYYYO)
          .WithCardInHandForPlayer(1, MID)
          .Build(),
      );

      await play(g); await play(g); await play(g);

      expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([CHEAP, SHYYYO, MID]);
      expect(readyResources(g)).toBe(0);
    });
  });

  describe("the gates", () => {
    it("no Kashyyyk base — no discount", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        board(3, Cards.bases.common.blue30HP) // Vigilance, but not Kashyyyk
          .WithGroundUnitForPlayer(1, SHYYYO)
          .WithCardInHandForPlayer(1, MID)
          .Build(),
      );

      await play(g);

      expect(readyResources(g)).toBe(0); // paid the full 3
    });

    it("Kashyyyk base but no Shyyyo — no discount", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(board(3).WithCardInHandForPlayer(1, MID).Build());

      await play(g);

      expect(readyResources(g)).toBe(0);
    });

    it("the opponent's plays are unaffected — 'units YOU play'", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        board(3)
          .WithGroundUnitForPlayer(1, SHYYYO)
          .FillResourcesForPlayer(2, CHEAP, 3)
          .WithCardInHandForPlayer(2, MID)
          .WithActivePlayer(2)
          .Build(),
      );

      await g.playCardFromHandAsync(2, 0);

      expect(g.state.player2.resources.filter(r => r.ready).length).toBe(0); // full 3
    });
  });

  describe("what advances the ladder", () => {
    it("an EVENT does not consume a rung", async () => {
      // Event costs 1 (3 → 2); the unit is still the FIRST at -1, costing 2 → 0 left.
      // If events counted, the unit would be the second (-2), cost 1, and one would survive.
      const g = new GameTestAdapter();
      g.loadNewState(
        board(3)
          .WithGroundUnitForPlayer(1, SHYYYO)
          .WithCardInHandForPlayer(1, EVENT)
          .WithCardInHandForPlayer(1, MID)
          .Build(),
      );

      await play(g); // the event
      await play(g); // the unit

      expect(g.state.player1.groundArena.some(u => u.cardId === MID)).toBe(true);
      expect(readyResources(g)).toBe(0);
      expect(g.state.player1.discard).toHaveLength(1);
    });
  });

  it("resets on the next round", async () => {
    // Round 1 spends 2+1+0 = 3 of 5. After the regroup every resource is ready again and the
    // first unit of round 2 is discounted -1, costing 2 of 5 → 3 left. A ladder that failed to
    // reset would charge the full 3 and leave 2.
    const g = new GameTestAdapter();
    let b = board(5).WithGroundUnitForPlayer(1, SHYYYO);
    for (let i = 0; i < 4; i++) b = b.WithCardInHandForPlayer(1, MID);
    for (let i = 0; i < 6; i++) b = b.WithCardInDeckForPlayer(1, CHEAP).WithCardInDeckForPlayer(2, CHEAP);
    g.loadNewState(b.Build());

    await play(g); await play(g); await play(g);
    expect(readyResources(g)).toBe(2);

    // Pass the round out, then decline both resource steps.
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});
    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.filter(u => u.cardId === MID)).toHaveLength(4);
    expect(readyResources(g)).toBe(3); // 5 - 2, the first rung again
  });

  it("chains with Kelleran Beq — the fetched unit takes BOTH discounts", async () => {
    // Shyyyo is out and the base is Kashyyyk. 7 ready:
    //   Kelleran Beq (cost 7) is the FIRST unit of the round → -1 → costs 6, leaving 1 ready.
    //   His When Played then plays a unit "costing 3 resources less" from the top 7 — and that
    //   unit is the SECOND unit played this round, so it takes Shyyyo's -2 as well.
    //   Dinosaur Turtle (cost 6): 6 - 2 (Shyyyo) - 3 (Beq) = 1, paid with the last ready resource.
    // So the ceiling for what Beq can pull is SIX, not three: 1 ready + 2 + 3.
    //
    // This only holds because the search prices through the same playCost pipeline that charges
    // the play. Pricing it as CardCost + aspect penalty - 3 would ignore Shyyyo entirely and cap
    // the reachable cost at 4.
    const g = new GameTestAdapter();
    g.loadNewState(
      board(7)
        .WithGroundUnitForPlayer(1, SHYYYO)
        .WithCardInHandForPlayer(1, Cards.units.lof.kelleranBeq)   // LOF_100, Command/Heroism
        .WithCardInDeckForPlayer(1, Cards.units.ash.dinosaurTurtle) // ASH_131, cost 6, Command
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(readyResources(g)).toBe(1); // 7 - 6, Beq took the first rung

    await g.chooseDeckSearchAsync(1, ["0"]);

    expect(g.state.player1.groundArena.map(u => u.cardId))
      .toEqual([SHYYYO, Cards.units.lof.kelleranBeq, Cards.units.ash.dinosaurTurtle]);
    expect(readyResources(g)).toBe(0); // the cost-6 unit cost exactly the 1 remaining resource
  });

  it("a Pilot played as an upgrade neither takes a rung nor advances one", async () => {
    // JTL_057's PILOTING cost is 2 (its unit cost is 1) and the attach path charges the piloting
    // cost, which never runs the play-cost discount stack. 4 ready → 2. The cost-3 unit after it
    // is then still the FIRST unit of the round at -1, costing 2 → 0 left.
    const g = new GameTestAdapter();
    g.loadNewState(
      board(4)
        .WithGroundUnitForPlayer(1, SHYYYO)
        .WithSpaceUnitForPlayer(1, "SOR_237")
        .WithCardInHandForPlayer(1, "JTL_057")
        .WithCardInHandForPlayer(1, MID)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.player1.spaceArena[0].upgrades.map(u => u.cardId)).toEqual(["JTL_057"]);
    expect(readyResources(g)).toBe(2);

    await g.playCardFromHandAsync(1, 0);

    expect(readyResources(g)).toBe(0); // the unit was still the FIRST rung
  });
});
