import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// SOR_182 Bossk — Deadly Stalker (4/5 Ground, cost 5, Cunning/Villainy)
//   "Ambush"
//   "When you play an event: You may deal 2 damage to a unit."
//
// Only events YOU play; a unit played does nothing.

const BOSSK = Cards.units.sor.bosskDeadlyStalker;
const EVENT = Cards.events.hmw.migrate; // cost 3 — makes Beasts, no targets of its own
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command — no penalty on Migrate
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithGroundUnitForPlayer(1, BOSSK)
    .WithGroundUnitForPlayer(2, CSF)
    .WithActivePlayer(1);
}

describe("SOR_182 Bossk — Deadly Stalker", () => {
  it("has Ambush", () => {
    expect(HasAmbush(BOSSK)).toBe(true);
  });

  it("playing an event: may deal 2 damage to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, EVENT).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, EVENT).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("playing a unit does not trigger it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
