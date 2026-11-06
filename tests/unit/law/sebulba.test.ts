import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// LAW_012 Sebulba — Especially Dangerous Dug (Leader, Aggression/Villainy; unit side 2/5 Ground)
//   Front: "Action [Exhaust, discard a card from your deck]: A friendly unit gains Raid 1 for this
//           phase. Epic Action: If you control 4 or more resources, deploy this leader."
//   Unit:  "Raid 1. On Attack: Discard a card from your deck."
// Discarding from the deck is part of the Action's COST, so an empty deck means no Action.

const SEBULBA = Cards.leaders.law.sebulba;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const WAMPA = Cards.units.sor.wampa;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(SEBULBA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

describe("LAW_012 Sebulba — leader Action", () => {
  it("discards the top card of the deck and gives a friendly unit Raid 1 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInDeckForPlayer(1, WAMPA).Build());
    const marine = g.state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    expect(g.state.player1.deck).toHaveLength(0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([WAMPA]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(RaidAmount(MARINE, marine, 1)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("with no friendly unit, it still pays the deck discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDeckForPlayer(1, WAMPA).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([WAMPA]);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("cannot be used with an empty deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    expect(ActionAbilities(SEBULBA, 1)).not.toContain(SEBULBA);
  });
});

describe("LAW_012 Sebulba — deployed", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const sebulbaIndex = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === SEBULBA);

  it("Raid 1, and On Attack discards a card from the deck", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInDeckForPlayer(1, WAMPA).WithCardInDeckForPlayer(1, MARINE).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, sebulbaIndex(g));
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // 2 + Raid 1
    expect(g.state.player1.deck).toHaveLength(1);
    expect(g.state.player1.discard).toHaveLength(1);
  });

  it("an empty deck is harmless", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, sebulbaIndex(g));
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });
});
