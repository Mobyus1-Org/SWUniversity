import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_006 Vel Sartha — Aldhani Insurgent (Leader, Vigilance/Heroism; unit side 4/7 Ground)
//   Front: "Action [Exhaust]: Give an Experience token to a unit. An opponent creates a Credit token.
//           Epic Action: If you control 6 or more resources, deploy this leader."
//   Unit:  "On Attack: You may give an Experience token to a unit. If you do, an opponent creates a
//           Credit token."
// The front's two sentences are independent: with no unit to give it to, the opponent still
// gets the Credit.

const VEL = Cards.leaders.law.velSartha;
const MARINE = Cards.units.sor.battlefieldMarine;
const XP = Cards.upgrades.token.experience;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(VEL)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

const credits = (g: GameTestAdapter, p: 1 | 2) => (p === 1 ? g.state.player1 : g.state.player2).supplemental.creditTokens ?? 0;
const xpOn = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

describe("LAW_006 Vel Sartha — leader Action", () => {
  it("gives an Experience token to a unit (either side) and an opponent creates a Credit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(xpOn(g.state.player2.groundArena[0])).toBe(1);
    expect(credits(g, 2)).toBe(1);
    expect(credits(g, 1)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("with no unit in play, the opponent still creates a Credit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(credits(g, 2)).toBe(1);
  });
});

describe("LAW_006 Vel Sartha — deployed On Attack", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const velIndex = (g: GameTestAdapter) => g.state.player1.groundArena.findIndex(u => u.cardId === VEL);

  it("may give an Experience token; if so, the opponent creates a Credit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    await deployed(g);
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!.playId;

    await g.attackWithGroundUnitAsync(1, velIndex(g));
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(xpOn(g.state.player1.groundArena.find(u => u.cardId === MARINE)!)).toBe(1);
    expect(credits(g, 2)).toBe(1);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("declining gives nothing to either player", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, velIndex(g));
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(xpOn(g.state.player1.groundArena[velIndex(g)])).toBe(0);
    expect(credits(g, 2)).toBe(0);
    expect(g.state.player2.base.damage).toBe(4);
  });
});
