import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_083 Pantoran Starship Thief (Unit 2/2 Ground, cost 2, Command/Villainy, Underworld/Pilot)
//   "When Played: You may pay 3 resources. If you do, attach this unit as an upgrade to a Fighter
//    or Transport unit without a Pilot on it. Take control of that unit.
//    When this upgrade detaches from a unit: That unit's owner takes control of it."

const THIEF = Cards.units.jtl.pantoranStarshipThief;
const TIE = Cards.units.sor.tieLnFighter;           // Space Vehicle, Fighter
const AWING = Cards.units.jtl.phoenixSquadronAWing; // Space Vehicle, Fighter
const RAIDER = Cards.units.ash.atStRaider;          // Vehicle, Walker — not a Fighter/Transport
const PILOT = Cards.units.jtl.wingmanVictorTwo;     // a Piloting unit
const MARINE = Cards.units.sor.battlefieldMarine;

function base(resources = 5) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Villainy + Command base — Thief at printed cost
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInHandForPlayer(1, THIEF);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];
const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("JTL_083 Pantoran Starship Thief", () => {
  it("pays 3, attaches to an enemy Fighter, and takes control of it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, TIE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
    const stolen = g.state.player1.spaceArena.find(u => u.cardId === TIE)!;
    expect(stolen.controller).toBe(1);
    expect(stolen.upgrades.map(u => u.cardId)).toEqual([THIEF]);
    expect(g.state.player1.groundArena.some(u => u.cardId === THIEF)).toBe(false);
    expect(ready(g)).toBe(0); // 2 + 3
  });

  it("offers Fighters and Transports on either side with no Pilot — nothing else", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, AWING)
        .WithSpaceUnitForPlayer(2, TIE)
        .WithSpaceUnitForPlayer(2, AWING)
        .WithUpgradesOnSpaceUnitForPlayer(2, 1, [GameStateBuilder.Upgrade(PILOT, 2)]) // already piloted
        .WithGroundUnitForPlayer(2, RAIDER)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect([...offer(g)].sort()).toEqual([g.state.player1.spaceArena[0].playId, g.state.player2.spaceArena[0].playId].sort());
  });

  it("declining pays nothing — it stays a ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, TIE).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([THIEF]);
    expect(g.state.player2.spaceArena).toHaveLength(1);
    expect(ready(g)).toBe(3);
  });

  it("can't afford the 3 — no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(4).WithSpaceUnitForPlayer(2, TIE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("when it detaches (the upgrade is defeated), the unit's owner takes it back", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(8).WithCardInHandForPlayer(1, Cards.events.sor.confiscate).WithSpaceUnitForPlayer(2, TIE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});

    await g.playCardFromHandAsync(1, g.state.player1.hand.findIndex(c => c.cardId === Cards.events.sor.confiscate));
    await g.chooseUpgradeOnSpaceUnitAsync(1, 1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.spaceArena.map(u => [u.cardId, u.controller])).toEqual([[TIE, 2]]);
    expect(g.state.player1.discard.some(c => c.cardId === THIEF)).toBe(true);
  });

  it("the stolen unit now has a Pilot — another Thief can't take it", async () => {
    const g = new GameTestAdapter();
    const state = base(10).WithSpaceUnitForPlayer(2, TIE).Build();
    state.player1.hand.push({ cardId: THIEF });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull(); // no pilotless Fighter left
  });
});
