import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_144 Howler Pack (3/3 Ground, cost 6, Command, Creature) —
//   "When Played/When Defeated: Create a Beast token."

const HOWLER = Cards.units.hmw.howlerPack;
const BEAST = Cards.units.token.beast;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7

const beasts = (g: GameTestAdapter) => g.state.player1.groundArena.filter(u => u.cardId === BEAST).length;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

describe("HMW_144 Howler Pack", () => {
  it("When Played: creates a Beast token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, HOWLER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(beasts(g)).toBe(1);
  });

  it("When Defeated: creates a Beast token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, HOWLER).WithGroundUnitForPlayer(2, CSF).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena.some(u => u.cardId === HOWLER)).toBe(false);
    expect(beasts(g)).toBe(1);
  });
});
