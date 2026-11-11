import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_004 Mace Windu — Here With Backup (Leader, Command/Heroism; unit side 4/7 Ground)
//   Front: "Action [1 resource, Exhaust]: Attack with a unit. It gains Restore 2 for this attack."
//   Unit:  "Restore 2. When Deployed: Resource the top card of your deck."

const MACE = Cards.leaders.ic27.maceWindu;
const MARINE = Cards.units.sor.battlefieldMarine;     // 3/3 Ground, no Restore
const SCOUT = Cards.units.ic27.magistratesScout;      // 2/4 Ground, printed Restore 2
const WAMPA = Cards.units.sor.wampa;

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function board(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 10) // damaged, so Restore has something to heal
    .MyLeader(MACE)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

describe("IC27_004 Mace Windu — leader Action", () => {
  it("attacks with a unit that gains Restore 2 for this attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(8); // 10 - 2
    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(7);
  });

  it("the Restore 2 lasts for this attack only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    g.state.player1.groundArena[0].ready = true;
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(8); // the second attack healed nothing
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("adds to the attacker's printed Restore (2 + 2 = 4)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SCOUT).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(6);
  });

  it("control: an ordinary attack by the same unit heals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(10);
  });

  it("an exhausted unit cannot be chosen; with no unit able to attack, the cost is still paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, false).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(7);
    expect(g.state.player1.base.damage).toBe(10);
  });
});

describe("IC27_004 Mace Windu — deployed", () => {
  it("When Deployed: resources the top card of the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board(6)
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, WAMPA) // top of deck (the deck pops from the end)
        .Build(),
    );

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.resources).toHaveLength(7);
    expect(g.state.player1.resources.at(-1)?.cardId).toBe(WAMPA);
    expect(g.state.player1.resources.at(-1)?.ready).toBe(false); // enters exhausted
    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("When Deployed: an empty deck resources nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.resources).toHaveLength(6);
  });

  it("Restore 2: attacking heals 2 from your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).Build());

    await g.deployLeaderAsync(1);
    g.state.activePlayer = 1;
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(8);
    expect(g.state.player2.base.damage).toBe(4);
  });
});
