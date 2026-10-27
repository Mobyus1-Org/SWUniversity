import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_068 Imperial Commandos (4/4 Ground, cost 6, Vigilance/Villainy)
//   "When Played: You may defeat a non-leader unit with 4 or less power."
//
// Either side's unit, and the Commandos themselves (4 power) qualify. The limit reads CURRENT
// power, so a buff carries a unit out of range. Leader units are never offered.
const COMMANDOS = Cards.units.hmw.imperialCommandos;
const POWER_3 = Cards.units.sor.battlefieldMarine;  // 3/3
const POWER_4 = Cards.units.sor.swoopRacer;         // 4/3 — the boundary
const POWER_5 = Cards.units.ash.deathTrooperSquad;  // 5/4 — one over
const XP = Cards.upgrades.token.experience;         // +1/+1

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, POWER_3, 14)
    .WithCardInHandForPlayer(1, COMMANDOS)
    .WithActivePlayer(1);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const commandos = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === COMMANDOS);
const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.find(u => u.cardId === cardId);

describe("HMW_068 Imperial Commandos — When Played: may defeat a non-leader unit with 4 or less power", () => {
  it("offers exactly the non-leader units with 4 or less power, both sides, itself included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .TheirLeader(Cards.leaders.sor.sabineWren, true, true)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // deployed leader — never offered
        .WithGroundUnitForPlayer(1, POWER_3)
        .WithGroundUnitForPlayer(2, POWER_4)
        .WithGroundUnitForPlayer(2, POWER_5)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);

    const ids = offered(g)!;
    expect(ids).toContain(find(g, 1, POWER_3)!.playId);
    expect(ids).toContain(find(g, 2, POWER_4)!.playId);
    expect(ids).toContain(commandos(g)!.playId);
    expect(ids).not.toContain(find(g, 2, POWER_5)!.playId);
    expect(ids).not.toContain(find(g, 2, Cards.leaders.sor.sabineWren)!.playId);
    expect(ids).toHaveLength(3);
  });

  it("reads CURRENT power: an Experience token carries a 4-power unit out of range", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, POWER_4)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(XP, 2)])
        .WithGroundUnitForPlayer(2, POWER_3)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(offered(g)).not.toContain(find(g, 2, POWER_4)!.playId);
    expect(offered(g)).toContain(find(g, 2, POWER_3)!.playId);
  });

  it("accepting defeats the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, POWER_4).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, POWER_4)!.playId] });

    expect(find(g, 2, POWER_4)).toBeUndefined();
    expect(g.state.player2.discard.some(c => c.cardId === POWER_4)).toBe(true);
    expect(commandos(g)).toBeDefined();
  });

  it("may be declined — nothing is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, POWER_4).Build());
    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option"); // the offer really appeared
    await g.chooseNoAsync(1);

    expect(find(g, 2, POWER_4)).toBeDefined();
    expect(commandos(g)).toBeDefined();
    expect(needs(g)).toBeFalsy();
  });

  it("a 5-power unit named by the client is refused", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, POWER_3).WithGroundUnitForPlayer(2, POWER_5).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, POWER_5)!.playId] });

    expect(find(g, 2, POWER_5)).toBeDefined();
  });
});
