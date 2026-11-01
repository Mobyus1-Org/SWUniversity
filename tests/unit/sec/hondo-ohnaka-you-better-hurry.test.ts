import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { HasPlot } from "@/server/engine/card-db/keyword-dictionaries.ts/plot";

// SEC_140 Hondo Ohnaka — You Better Hurry (6/5 Ground, cost 6, Aggression/Villainy, Underworld, unique)
//   "Each other friendly unit gains Raid 1."
//   Plot
// The aura is SOR_012 IG-88's deployed side.

const HONDO = Cards.units.sec.hondoOhnakaYouBetterHurry;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground, no text

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.ig88) // Aggression/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

const attackBase = async (g: GameTestAdapter, unitIndex: number) => {
  await g.attackWithGroundUnitAsync(1, unitIndex);
  if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
};

describe("SEC_140 Hondo Ohnaka — each other friendly unit gains Raid 1", () => {
  it("control: a vanilla unit without Hondo deals its printed power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    await attackBase(g, 0);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("a friendly unit attacking gets +1/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HONDO).WithGroundUnitForPlayer(1, MARINE).Build());
    await attackBase(g, 1);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("Hondo himself does not gain Raid from his own aura", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HONDO).Build());
    const h = g.state.player1.groundArena[0];
    expect(RaidAmount(h.cardId, h.playId, 1)).toBe(0);
    await attackBase(g, 0);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("enemy units do not gain Raid", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HONDO).WithGroundUnitForPlayer(2, MARINE).Build());
    const enemy = g.state.player2.groundArena[0];
    expect(RaidAmount(enemy.cardId, enemy.playId, 2)).toBe(0);
  });

  it("the aura switches off while Hondo has lost his abilities", () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, HONDO).WithGroundUnitForPlayer(1, MARINE).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning,
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);
    const m = g.state.player1.groundArena[1];
    expect(RaidAmount(m.cardId, m.playId, 1)).toBe(0);
  });
});

describe("SEC_140 Hondo Ohnaka — Plot", () => {
  it("has the Plot keyword", () => {
    expect(HasPlot(HONDO)).toBe(true);
  });

  it("can be played from resources when a leader deploys, paying its cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .FillResourcesForPlayer(1, MARINE, 11)
        .FillResourcesForPlayer(1, HONDO, 1) // resource index 11
        .Build(),
    );

    await g.deployLeaderAsync(1);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Plot");
    await g.choosePlotCardAsync(1, 11);

    expect(g.state.player1.groundArena.some(u => u.cardId === HONDO)).toBe(true);
    expect(g.state.player1.resources.some(r => r.cardId === HONDO)).toBe(false);
    // 11 Marines left once Hondo leaves the resource row (empty deck: no replacement); 6 paid.
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(5);
  });
});
