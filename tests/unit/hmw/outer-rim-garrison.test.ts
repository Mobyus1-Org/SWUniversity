import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// HMW_146 Outer Rim Garrison (6/6 Ground, cost 7, Command, Republic Clone Twi'lek Trooper)
//   Ambush (When you play this unit, it may attack an enemy unit.)
//   Overwhelm (When attacking an enemy unit, deal excess damage to the opponent's base.)
const GARRISON = Cards.units.hmw.outerRimGarrison;
const ENEMY = Cards.units.sor.battlefieldMarine; // 3/3 — 3 excess from a 6-power hit

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
    .WithCardInHandForPlayer(1, GARRISON)
    .WithGroundUnitForPlayer(2, ENEMY)
    .WithActivePlayer(1)
    .Build();
}

describe("HMW_146 Outer Rim Garrison", () => {
  it("has both keywords registered", () => {
    expect(HasAmbush(GARRISON)).toBe(true);
    expect(HasOverwhelm(GARRISON)).toBe(true);
  });

  it("Ambush: on play it may attack an enemy unit; Overwhelm spills the excess to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // the Ambush offer
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(3); // 6 power into a 3/3 → 3 excess
    expect(g.state.player1.groundArena[0].damage).toBe(3); // counter-attack
  });

  it("the Ambush may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.groundArena[0].cardId).toBe(GARRISON);
  });
});
