import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_117 Hera Syndulla — Against the Odds (4/3 Ground, cost 3, Aggression/Heroism)
//   "When you play another Rebel card: Deal 1 damage to a base."  Mandatory; either base.

const HERA = Cards.units.ic27.heraSyndulla;
const MARINE = Cards.units.sor.battlefieldMarine; // Rebel
const SWOOP = Cards.units.sor.swoopRacer;         // Fringe — not a Rebel

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 12)
    .FillResourcesForPlayer(2, MARINE, 12);
}

const res = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; options?: string[]; fromPlayIds?: string[]; fromZones?: string[] } | undefined;

describe("IC27_117 Hera Syndulla", () => {
  it("playing another Rebel unit: 1 damage to the chosen base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HERA).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(res(g)?.type).toBe("Target");
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("may hit your own base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HERA).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("a non-Rebel card: nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HERA).WithCardInHandForPlayer(1, SWOOP).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(res(g)).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("her own play does not count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, HERA).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(res(g)).toBeFalsy();
  });

  it("an opponent's Rebel card: nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HERA).WithCardInHandForPlayer(2, MARINE).WithActivePlayer(2).Build());

    await g.playCardFromHandAsync(2, 0);

    expect(res(g)).toBeFalsy();
    expect(g.state.player1.base.damage + g.state.player2.base.damage).toBe(0);
  });

  it("a Rebel EVENT counts too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HERA).WithCardInHandForPlayer(1, Cards.events.sor.rebelAssault).Build());

    await g.playCardFromHandAsync(1, 0);
    await drive(g);

    // Hera's 1, plus Rebel Assault's attack: Hera 4 + 1 (the only Rebel, so only one attack).
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("a Rebel UPGRADE counts too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, HERA).WithCardInHandForPlayer(1, Cards.upgrades.law.fulcrum).Build());

    await g.playCardFromHandAsync(1, 0);
    await drive(g);

    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toEqual([Cards.upgrades.law.fulcrum]);
    expect(g.state.player2.base.damage).toBe(1);
  });
});

/** Answers whatever comes up: a unit pick takes P1's first unit, a base pick takes P2's base. */
async function drive(g: GameTestAdapter) {
  for (let i = 0; i < 8; i++) {
    const r = res(g);
    if (!r) return;
    if (r.type === "Option" && r.options?.length) {
      await g.chooseOptionAsync(1, r.options[0]);
    } else if (r.type === "Target" && (r.fromPlayIds ?? []).includes(g.state.player1.groundArena[0]?.playId)) {
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    } else {
      await g.chooseBaseAsync(1, 2);
    }
  }
}
