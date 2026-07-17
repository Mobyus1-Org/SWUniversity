import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_132 Queen Soruna (Ground, cost 6) — "When Played/On Attack: You may reveal a unit from
// your hand. If you do, deal 3 damage to a unit with the same cost as the revealed unit."
// systemPatrolCraft (SOR_066) costs 3, 4 HP — survives the 3 damage; gamorreanGuards (SOR_211)
// costs 4 — a mismatch decoy.

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_132 Queen Soruna — When Played", () => {
  it("reveals a unit and deals 3 damage to a unit with the same cost", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.queenSoruna)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft) // cost 3, to reveal
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // cost 4 — no match
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // cost 3 — matches, damage target
      .WithGroundUnitForPlayer(1, Cards.units.token.battleDroid) // filler, cost 1 — no match
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // reveal the System Patrol Craft (cost 3)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const target = g.state.player2.spaceArena.find(u => u.playId === targetPlayId)!;
    expect(target.damage).toBe(3);
    // The revealed card stays in hand (only revealed, not played).
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.systemPatrolCraft)).toBe(true);
  });

  it("may decline the reveal — nothing happens", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.queenSoruna)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("fizzles when no unit shares the revealed unit's cost (control)", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.queenSoruna)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // cost 4 — no match
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const revealed = await g.chooseCardFromHandAsync(1, 0);

    expect(revealed.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does not offer the reveal option with no Unit cards in hand", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithCardInHandForPlayer(1, Cards.units.ash.queenSoruna)
      .WithCardInHandForPlayer(1, Cards.events.ash.galvanizedLeap) // not a Unit
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
      .Build();
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});

describe("ASH_132 Queen Soruna — On Attack", () => {
  it("also fires the reveal ability when Queen Soruna attacks", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.ash.queenSoruna)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft) // cost 3, to reveal
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // cost 4 — attack target, no match
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // cost 3 — matches, damage target
      .Build();
    g.loadNewState(state);

    const targetPlayId = state.player2.spaceArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // choose the actual attack target (Gamorrean Guards)
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const target = g.state.player2.spaceArena.find(u => u.playId === targetPlayId)!;
    expect(target.damage).toBe(3);
  });
});
