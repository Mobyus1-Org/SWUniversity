import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// IC27_016 is a reprint of TWI_031: same text and stats, so this mirrors TWI_031's tests.

// IC27_016 Rune Haako — Scheming Second (3/2 Ground, cost 2)
// "When Played: If a friendly unit was defeated this phase, you may give a unit –1/–1 for this phase."

const HAAKO = Cards.units.ic27.runeHaako;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const WAMPA = Cards.units.sor.wampa;              // 4/5

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20)
    .WithGroundUnitForPlayer(2, WAMPA)
    .WithCardInHandForPlayer(1, HAAKO);
}

const wampa = (g: GameTestAdapter) =>
  Unit.FromInterface(g.state.player2.groundArena.find(u => u.cardId === WAMPA)!);

/** Player 1 loses a unit this phase: their Marine attacks the Wampa and dies to the counter. */
async function loseAFriendlyUnit(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
  await g.dispatchAsync(2, "pass-action", {});
}

describe("IC27_016 Rune Haako — When Played", () => {
  it("after a friendly unit died this phase, may give a unit -1/-1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    await loseAFriendlyUnit(g);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa(g).playId] });

    expect(wampa(g).CurrentPower()).toBe(3);
    expect(wampa(g).TotalHP()).toBe(4);
  });

  it("is optional — declining leaves stats alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    await loseAFriendlyUnit(g);

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // offered, then declined
    await g.chooseNoAsync(1);

    expect(wampa(g).CurrentPower()).toBe(4);
  });

  it("control: offers nothing when no friendly unit died this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(wampa(g).CurrentPower()).toBe(4);
  });
});
