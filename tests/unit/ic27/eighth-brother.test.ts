import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_099 Eighth Brother — Ill-Fated Escape (3/1 Ground, cost 2, Aggression/Villainy)
//   "When Defeated: You may ready an Imperial unit."
// "An Imperial unit" is unqualified, so an enemy Imperial unit is a legal choice too. Only exhausted
// ones are offered — readying a ready unit does nothing.

const EIGHTH = Cards.units.ic27.eighthBrother;
const TROOPER = Cards.units.sor.deathStarStormtrooper; // Imperial
const MARINE = Cards.units.sor.battlefieldMarine;      // Rebel

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, EIGHTH)
    .WithCardInHandForPlayer(1, Cards.events.twi.lethalCrackdown);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? res.fromPlayIds : undefined;
};

async function defeatEighthBrother(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
}

describe("IC27_099 Eighth Brother — When Defeated", () => {
  it("may ready an exhausted Imperial unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TROOPER).Build());
    g.state.player1.groundArena[1].ready = false;
    const trooper = g.state.player1.groundArena[1].playId;

    await defeatEighthBrother(g);
    await g.chooseYesAsync(1);
    expect(offered(g)).toEqual([trooper]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [trooper] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([TROOPER]);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("declining leaves it exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TROOPER).Build());
    g.state.player1.groundArena[1].ready = false;

    await defeatEighthBrother(g);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("an enemy Imperial unit is a legal choice; non-Imperial units are not", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, TROOPER).Build());
    g.state.player1.groundArena[1].ready = false;
    g.state.player2.groundArena[0].ready = false;
    const enemyTrooper = g.state.player2.groundArena[0].playId;

    await defeatEighthBrother(g);
    await g.chooseYesAsync(1);
    expect(offered(g)).toEqual([enemyTrooper]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyTrooper] });

    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("control: with no exhausted Imperial unit there is no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, TROOPER).Build()); // ready already

    await defeatEighthBrother(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([TROOPER]);
  });
});
