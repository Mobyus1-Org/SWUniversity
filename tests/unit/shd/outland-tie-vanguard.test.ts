import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_082 Outland TIE Vanguard (2/1 Space, cost 2, Imperial/Vehicle/Fighter) —
//   "When Played: You may give an Experience token to another unit that costs 3 or less."
//
// Three restrictions stacked on the same grant its siblings make: OPTIONAL, "another" (never
// itself), and a cost ceiling of 3. Each is a separate way to get it wrong.

const VANGUARD = "SHD_082";
const XP = Cards.upgrades.token.experience;
const CHEAP = Cards.units.sor.battlefieldMarine;      // cost 2
const EXPENSIVE = Cards.units.ash.dinosaurTurtle;     // cost 6

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, CHEAP, 14)
    .WithCardInHandForPlayer(1, VANGUARD)
    .WithActivePlayer(1);
}

const xpOn = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

describe("SHD_082 Outland TIE Vanguard", () => {
  it("gives an Experience token to a cheap unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CHEAP).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(1);
  });

  it("does not offer a unit costing more than 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, CHEAP)
        .WithGroundUnitForPlayer(1, EXPENSIVE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    const pricey = g.state.player1.groundArena.find(u => u.cardId === EXPENSIVE)!;
    expect(offered).not.toContain(pricey.playId);
  });

  it("does not offer ITSELF — the text says 'another'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CHEAP).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    const offered = pending?.type === "Target" ? (pending.fromPlayIds ?? []) : [];
    const self = g.state.player1.spaceArena.find(u => u.cardId === VANGUARD)!;
    expect(offered).not.toContain(self.playId);
  });

  it("is optional — declining gives no token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CHEAP).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(xpOn(g.state.player1.groundArena[0])).toBe(0);
  });

  it("asks nothing when no other unit is cheap enough", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, EXPENSIVE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
