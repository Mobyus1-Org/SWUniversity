import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// HMW_042 Dooku — Corruption Must Be Eradicated (8/7 Ground, cost 8, Vigilance/Aggression,
// Force Jedi Republic, unique)
//   Overwhelm
//   When Played: You may ready another unit. If you do, heal damage from a base equal to that
//   unit's cost.
//
// "Another unit" is either side's. Only an exhausted unit that is allowed to ready is offered —
// readying a ready unit, or one that can't ready, wouldn't be "if you do". The heal reads the
// readied unit's cost and goes on either base.
const DOOKU = Cards.units.hmw.dookuCorruption;
const COST_4 = Cards.units.sor.consularSecurityForce; // 3/7, cost 4
const COST_3 = Cards.units.sor.swoopRacer;            // 4/3, cost 3
const READY = Cards.units.sor.battlefieldMarine;      // left ready — never offered
const TOKEN = Cards.units.token.cloneTrooper;         // cost 0

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 10)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP, 10)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, DOOKU)
    .WithActivePlayer(1);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  [...(p === 1 ? g.state.player1 : g.state.player2).groundArena,
   ...(p === 1 ? g.state.player1 : g.state.player2).spaceArena].find(x => x.cardId === cardId)!;
const dookuIndex = (g: GameTestAdapter) => g.state.player1.hand.findIndex(c => c.cardId === DOOKU);

describe("HMW_042 Dooku — Overwhelm", () => {
  it("has Overwhelm", () => {
    expect(HasOverwhelm(DOOKU)).toBe(true);
  });

  it("excess damage on a smaller enemy unit spills to the enemy base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, DOOKU)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
        .Build(),
    );
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(10 + 5); // 8 power − 3 HP
  });
});

describe("HMW_042 Dooku — When Played: ready another unit, heal a base by its cost", () => {
  it("offers only other exhausted units, on both sides", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, COST_4, false)
        .WithGroundUnitForPlayer(1, READY, true)
        .WithGroundUnitForPlayer(2, COST_3, false)
        .Build(),
    );
    await g.playCardFromHandAsync(1, dookuIndex(g));
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);

    const ids = offered(g)!;
    expect(ids).toContain(find(g, 1, COST_4).playId);
    expect(ids).toContain(find(g, 2, COST_3).playId);
    expect(ids).not.toContain(find(g, 1, READY).playId);
    expect(ids).not.toContain(find(g, 1, DOOKU).playId); // "another" — Dooku entered exhausted
    expect(ids).toHaveLength(2);
  });

  it("readies the chosen unit, then heals your base by its cost (base picked the UI way)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, COST_4, false).Build());
    await g.playCardFromHandAsync(1, dookuIndex(g));
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, COST_4).playId] });

    expect(find(g, 1, COST_4).ready).toBe(true);
    expect(needs(g)?.type).toBe("Target"); // now the base
    await g.chooseBaseAsync(1, 1);
    expect(g.state.player1.base.damage).toBe(6);
    expect(g.state.player2.base.damage).toBe(10);
  });

  it("can ready an enemy unit and heal the enemy base (base picked by playId)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, COST_3, false).Build());
    await g.playCardFromHandAsync(1, dookuIndex(g));
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, COST_3).playId] });

    expect(find(g, 2, COST_3).ready).toBe(true);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player2.base"] });
    expect(g.state.player2.base.damage).toBe(7);
    expect(g.state.player1.base.damage).toBe(10);
  });

  it("may be declined — nothing readies, nothing heals", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, COST_4, false).Build());
    await g.playCardFromHandAsync(1, dookuIndex(g));
    expect(needs(g)?.type).toBe("Option"); // the offer really appeared
    await g.chooseNoAsync(1);

    expect(find(g, 1, COST_4).ready).toBe(false);
    expect(g.state.player1.base.damage).toBe(10);
    expect(needs(g)).toBeFalsy();
  });

  it("no prompt when every other unit is already ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, READY, true).WithGroundUnitForPlayer(2, COST_3, true).Build());
    await g.playCardFromHandAsync(1, dookuIndex(g));
    expect(needs(g)).toBeFalsy();
    expect(find(g, 1, DOOKU)).toBeDefined();
  });

  it("a unit that can't ready (No Good to Me Dead) is not offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, COST_4, false)
        .WithGroundUnitForPlayer(2, COST_3, true)
        .WithCardInHandForPlayer(1, Cards.events.sor.noGoodToMeDead)
        .Build(),
    );
    const ngIndex = g.state.player1.hand.findIndex(c => c.cardId === Cards.events.sor.noGoodToMeDead);
    await g.playCardFromHandAsync(1, ngIndex);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, COST_3).playId] });
    expect(find(g, 2, COST_3).ready).toBe(false);
    await g.dispatchAsync(2, "pass-action", {});

    await g.playCardFromHandAsync(1, dookuIndex(g));
    await g.chooseYesAsync(1);
    const ids = offered(g)!;
    expect(ids).toContain(find(g, 1, COST_4).playId);
    expect(ids).not.toContain(find(g, 2, COST_3).playId);
  });

  it("readying a 0-cost token heals nothing and asks for no base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, TOKEN, false).Build());
    await g.playCardFromHandAsync(1, dookuIndex(g));
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, TOKEN).playId] });

    expect(find(g, 1, TOKEN).ready).toBe(true);
    expect(needs(g)).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(10);
  });
});
