import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_189 Slaver's Freighter (4/5 Space, cost 5, Cunning/Villainy)
//   "When Played: You may ready another unit with power equal to or less than the number of
//    upgrades on enemy units."
//
// The count is every upgrade on every ENEMY unit — token upgrades included; upgrades on friendly
// units don't count. "Another unit" is either side's, never the Freighter itself. Only an
// exhausted unit that is allowed to ready is offered: readying a ready unit would do nothing.
const FREIGHTER = Cards.units.shd.slaversFreighter;
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3
const TROOPER = Cards.units.token.cloneTrooper;    // 2/2 token
const DROID = Cards.units.token.battleDroid;       // 1/1 token
const XP = Cards.upgrades.token.experience;
const SHIELD = Cards.upgrades.token.shield;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, FREIGHTER)
    .WithActivePlayer(1);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.find(u => u.cardId === cardId)!;
const freighter = (g: GameTestAdapter) => g.state.player1.spaceArena.find(u => u.cardId === FREIGHTER)!;

/** P2's Marine carries 2 token upgrades — the count is 2. */
function twoEnemyUpgrades() {
  return base()
    .WithGroundUnitForPlayer(2, MARINE)
    .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(XP, 2), GameStateBuilder.Upgrade(SHIELD, 2)]);
}

describe("SHD_189 Slaver's Freighter — When Played: may ready another unit with power ≤ upgrades on enemy units", () => {
  it("offers exactly the other exhausted units with power ≤ the count, on both sides", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      twoEnemyUpgrades()
        .WithGroundUnitForPlayer(1, TROOPER, false)  // 2 power — in
        .WithGroundUnitForPlayer(1, MARINE, false)   // 3 power — out
        .WithGroundUnitForPlayer(2, DROID, false)    // 1 power, enemy — in
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);

    const ids = offered(g)!;
    expect(ids).toContain(find(g, 1, TROOPER).playId);
    expect(ids).toContain(find(g, 2, DROID).playId);
    expect(ids).not.toContain(find(g, 1, MARINE).playId);
    expect(ids).toHaveLength(2);
  });

  it("never offers the Freighter itself, even when its power is in range", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          GameStateBuilder.Upgrade(XP, 2), GameStateBuilder.Upgrade(XP, 2),
          GameStateBuilder.Upgrade(XP, 2), GameStateBuilder.Upgrade(SHIELD, 2),
        ]) // 4 upgrades — the 4-power Freighter would qualify
        .WithGroundUnitForPlayer(1, MARINE, false)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(offered(g)).toEqual([find(g, 1, MARINE).playId]);
    expect(freighter(g).ready).toBe(false);
  });

  it("accepting readies the chosen exhausted unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(twoEnemyUpgrades().WithGroundUnitForPlayer(1, TROOPER, false).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, TROOPER).playId] });

    expect(find(g, 1, TROOPER).ready).toBe(true);
    expect(needs(g)).toBeFalsy();
  });

  it("may be declined — the unit stays exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(twoEnemyUpgrades().WithGroundUnitForPlayer(1, TROOPER, false).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option"); // the offer really appeared
    await g.chooseNoAsync(1);

    expect(find(g, 1, TROOPER).ready).toBe(false);
    expect(needs(g)).toBeFalsy();
  });

  it("upgrades on FRIENDLY units don't count — no enemy upgrades, no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, TROOPER, false)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(XP, 1), GameStateBuilder.Upgrade(SHIELD, 1)])
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)).toBeFalsy();
    expect(find(g, 1, TROOPER).ready).toBe(false);
  });

  it("a unit over the count named by the client is refused", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      twoEnemyUpgrades()
        .WithGroundUnitForPlayer(1, TROOPER, false)
        .WithGroundUnitForPlayer(1, MARINE, false)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE).playId] });

    expect(find(g, 1, MARINE).ready).toBe(false);
  });
});
