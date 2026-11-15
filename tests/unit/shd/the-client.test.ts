import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import { Unit } from "@/server/engine/unit";

// SHD_031 The Client — Dictated by Discretion (2/5 Ground, cost 3, Villainy/Vigilance)
//   "Shielded"
//   "Action [Exhaust]: Choose a unit. For this phase, it gains: 'Bounty — Heal 5 damage from a base.'"
//
// The Bounty is collected by the defeated unit's opponent, who picks either base to heal.

const CLIENT = Cards.units.shd.theClient;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 8)
    .MyLeader(Cards.leaders.sor.idenVersio)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, CLIENT)
    .WithGroundUnitForPlayer(1, CSF)
    .WithGroundUnitForPlayer(2, MARINE)
    .WithActivePlayer(1);
}

describe("SHD_031 The Client", () => {
  it("has Shielded", () => {
    expect(HasShielded(CLIENT)).toBe(true);
  });

  it("Action: the chosen unit's Bounty lets its opponent heal 5 from a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.dispatchAsync(1, "use-ability", { cardId: CLIENT, playId: g.state.player1.groundArena[0].playId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(g.state.player1.groundArena[0].ready).toBe(false); // the exhaust cost
    expect(Unit.FromInterface(g.state.player2.groundArena[0]).HasBounty()).toBe(true);

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1); // the CSF defeats the Marine
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.damage).toBe(3);
  });

  it("control: without the grant, defeating the Marine offers no Bounty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
