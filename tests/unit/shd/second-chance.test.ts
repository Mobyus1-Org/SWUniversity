import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { DiscardPlayableCards } from "@/server/engine/card-playability";
import { Cards } from "../../card-helpers";

// SHD_053 Second Chance (Upgrade +0/+0, cost 4, Vigilance ×2, Gambit)
//   "Attach to a non-leader unit.
//    Attached unit gains: 'When Defeated: For this phase, this unit's owner may play it from their
//    discard pile for free.'"

const SECOND_CHANCE = Cards.upgrades.shd.secondChance;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7 — kills a 3/3 attacker

function base(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic) // Vigilance/Villainy — with the base, both icons covered
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

/** Player 1's ground unit 0 (a Marine carrying Second Chance) attacks the 3/7 and dies. */
async function marineDiesAttacking(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseGroundUnitAsync(2, 0);
}

describe("SHD_053 Second Chance", () => {
  it("attaches only to a NON-LEADER unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(10)
        .WithCardInHandForPlayer(1, SECOND_CHANCE)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.directorKrennic) // a deployed leader unit
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player1.groundArena[1].playId]);
  });

  it("when the host is defeated, its owner may play it from the discard for FREE this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(0) // no resources at all — the replay must cost nothing
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SECOND_CHANCE, 1)])
        .WithGroundUnitForPlayer(2, DURABLE)
        .Build(),
    );

    await marineDiesAttacking(g);
    expect(g.state.player1.groundArena).toHaveLength(0);
    const marineInDiscard = g.state.player1.discard.find(c => c.cardId === MARINE)!;
    expect(DiscardPlayableCards(g.state, 1)).toEqual([{ playId: marineInDiscard.playId, cardId: MARINE, cost: 0 }]);
    await g.dispatchAsync(2, "pass-action", {});

    await g.dispatchAsync(1, "play-card", { cardId: MARINE, fromZone: "Discard", playId: marineInDiscard.playId });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(g.state.player1.discard.some(c => c.cardId === MARINE)).toBe(false);
    // Second Chance itself is just discarded — it grants nothing to its own card.
    expect(g.state.player1.discard.some(c => c.cardId === SECOND_CHANCE)).toBe(true);
  });

  it("the free play is used up once the unit is played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(0)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SECOND_CHANCE, 1)])
        .WithGroundUnitForPlayer(2, DURABLE)
        .Build(),
    );

    await marineDiesAttacking(g);
    await g.dispatchAsync(2, "pass-action", {});
    const playId = g.state.player1.discard.find(c => c.cardId === MARINE)!.playId;
    await g.dispatchAsync(1, "play-card", { cardId: MARINE, fromZone: "Discard", playId });

    expect(g.state.roundState.discardPlayGrants).toEqual([]);
  });

  it("control: a unit without Second Chance gets no free replay", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(10).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, DURABLE).Build());

    await marineDiesAttacking(g);
    await g.dispatchAsync(2, "pass-action", {});
    const playId = g.state.player1.discard.find(c => c.cardId === MARINE)!.playId;

    expect(DiscardPlayableCards(g.state, 1)).toEqual([]);
    await g.dispatchAsync(1, "play-card", { cardId: MARINE, fromZone: "Discard", playId });
    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player1.groundArena).toHaveLength(0);
  });

  it("the OWNER gets the replay — a stolen unit goes home, and only its owner may replay it", async () => {
    const g = new GameTestAdapter();
    const state = base(0)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SECOND_CHANCE, 1)])
      .WithGroundUnitForPlayer(2, DURABLE)
      .Build();
    state.player1.groundArena[0].owner = 2; // player 1 controls player 2's Marine
    g.loadNewState(state);

    await marineDiesAttacking(g);

    const home = g.state.player2.discard.find(c => c.cardId === MARINE)!;
    expect(home).toBeDefined();
    expect(g.state.roundState.discardPlayGrants).toEqual([
      expect.objectContaining({ player: 2, playId: home.playId, free: true }),
    ]);
    expect(DiscardPlayableCards(g.state, 1)).toEqual([]);
    expect(DiscardPlayableCards(g.state, 2).map(c => c.cardId)).toEqual([MARINE]);
  });
});
