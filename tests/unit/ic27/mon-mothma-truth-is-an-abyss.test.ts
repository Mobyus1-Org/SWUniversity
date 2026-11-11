import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_077 Mon Mothma — Truth is an Abyss (3/6 Ground, cost 4, Command/Heroism)
//   "When Played: You may attack with another unit, even if it's exhausted. For this attack, it gains
//    Overwhelm and can't attack bases."

const MOTHMA = Cards.units.ic27.monMothma;
const MARINE = Cards.units.sor.battlefieldMarine;           // 3/3, no Overwhelm
const STORMTROOPER = Cards.units.sor.deathStarStormtrooper; // 3/1

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, MOTHMA);
}

describe("IC27_077 Mon Mothma — Truth is an Abyss", () => {
  it("an EXHAUSTED friendly unit attacks with Overwhelm, and only units are offered as targets", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE, false).WithGroundUnitForPlayer(2, STORMTROOPER).Build());
    const marine = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    const pickRes = g.lastDispatchResponse?.resolutionNeeded;
    expect(pickRes?.type === "Target" ? pickRes.fromPlayIds : []).toEqual([marine]); // not Mon Mothma
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });
    const attackRes = g.lastDispatchResponse?.resolutionNeeded;
    expect(attackRes?.type === "Target" ? attackRes.fromZones : "x").toBeUndefined(); // no base
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(2); // 3 power − 1 HP
  });

  it("a dispatched base attack is refused", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, STORMTROOPER).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(0);
  });

  it("the Overwhelm is for that attack only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, STORMTROOPER)
      .WithGroundUnitForPlayer(2, STORMTROOPER)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.base.damage).toBe(2);
    g.state.player1.groundArena[0].ready = true;
    g.state.player1.groundArena[0].damage = 0;
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(2); // no excess the second time
  });

  it("declining attacks with nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, STORMTROOPER).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena.find(u => u.cardId === MARINE)!.ready).toBe(true);
  });

  it("no prompt without another friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, STORMTROOPER).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
