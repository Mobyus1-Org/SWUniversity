import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_056 Allegiant General Pryde — Heartless Efficiency (2/2 Ground, cost 1, Command/Villainy)
//   "When Defeated: Give an Experience token to the friendly unit with the most power. (If multiple
//    units are tied, choose one.)"

const PRYDE = Cards.units.ic27.allegiantGeneralPryde;
const MARINE = Cards.units.sor.battlefieldMarine;     // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7
const XWING = Cards.units.sor.allianceXWing;           // 2/3 space
const WAMPA = Cards.units.sor.wampa;                   // 4/5
const RIVALS_FALL = Cards.events.shd.rivalsFall;
const XP = Cards.upgrades.token.experience;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 12)
    .WithCardInHandForPlayer(1, RIVALS_FALL)
    .WithGroundUnitForPlayer(1, PRYDE);
}

const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

async function defeatPryde(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  await g.chooseGroundUnitAsync(1, 0);
}

describe("IC27_056 Allegiant General Pryde — When Defeated", () => {
  it("a single strongest friendly unit gets the token without a prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(1, MARINE).Build());

    await defeatPryde(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    const units = g.state.player1.groundArena;
    expect(xp(units.find(u => u.cardId === WAMPA)!)).toBe(1);
    expect(xp(units.find(u => u.cardId === MARINE)!)).toBe(0);
  });

  it("with a tie, only the tied units are offered and the chosen one gets it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(1, SECURITY)
      .WithSpaceUnitForPlayer(1, XWING)
      .Build());
    const security = g.state.player1.groundArena[2].playId;
    const marine = g.state.player1.groundArena[1].playId;

    await defeatPryde(g);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type === "Target" ? [...(res.fromPlayIds ?? [])].sort() : []).toEqual([marine, security].sort());
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [security] });

    expect(xp(g.state.player1.groundArena.find(u => u.playId === security)!)).toBe(1);
    expect(xp(g.state.player1.groundArena.find(u => u.playId === marine)!)).toBe(0);
  });

  it("only friendly units count — a stronger enemy unit is ignored", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());

    await defeatPryde(g);

    expect(xp(g.state.player1.groundArena[0])).toBe(1);
    expect(xp(g.state.player2.groundArena[0])).toBe(0);
  });

  it("with no other friendly unit nothing happens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).Build());

    await defeatPryde(g);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(xp(g.state.player2.groundArena[0])).toBe(0);
  });
});
