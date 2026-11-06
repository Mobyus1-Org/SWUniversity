import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// TS26_06 Rex — No Other Option (Leader, Aggression/Heroism; unit side 5/6 Ground)
//   Front: "Action [Exhaust, ready an exhausted enemy unit]: The next event you play this phase
//           costs 1 resource less. Epic Action: If you control 6 or more resources, deploy this leader."
//   Unit:  "On Attack: You may ready an exhausted enemy unit. If you do, the next event you play this
//           phase costs 2 resources less."

const REX = Cards.leaders.ts26.rex;
const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa;
const FORCE_WITH_ME = Cards.events.sor.theForceIsWithMe; // cost 4 event
const CONSULAR = Cards.units.sor.consularSecurityForce;  // cost 4 unit

// Yellow base (Cunning) + Rex (Aggression/Heroism): Vigilance is uncovered on both 4-costs, so 6.
function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(REX)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

describe("TS26_06 Rex — leader Action", () => {
  it("readies an exhausted enemy unit as the cost; the next event costs 1 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA, false).WithGroundUnitForPlayer(2, MARINE).Build());
    const wampa = g.state.player2.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type === "Target" ? res.fromPlayIds : []).toEqual([wampa]); // only the exhausted one
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wampa] });

    expect(g.state.player2.groundArena[0].ready).toBe(true);
    expect(playCost(g.state, 1, FORCE_WITH_ME)).toBe(5);
    expect(playCost(g.state, 1, CONSULAR)).toBe(6); // events only
  });

  it("is spent by the next event", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA, false)
      .WithCardInHandForPlayer(1, FORCE_WITH_ME).WithCardInHandForPlayer(1, FORCE_WITH_ME).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    expect(playCost(g.state, 1, FORCE_WITH_ME)).toBe(5);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.hand).toHaveLength(1);
    expect(playCost(g.state, 1, FORCE_WITH_ME)).toBe(6);
  });

  it("cannot be used without an exhausted enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).WithGroundUnitForPlayer(1, MARINE, false).Build());

    expect(ActionAbilities(REX, 1)).not.toContain(REX);
  });
});

describe("TS26_06 Rex — deployed On Attack", () => {
  async function attackWithRex(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === REX));
    await g.chooseBaseAsync(1, 2);
  }

  it("may ready an exhausted enemy unit; if so, the next event costs 2 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA, false).Build());

    await attackWithRex(g);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].ready).toBe(true);
    expect(playCost(g.state, 1, FORCE_WITH_ME)).toBe(4);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("declining: no ready, no discount", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA, false).Build());

    await attackWithRex(g);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(playCost(g.state, 1, FORCE_WITH_ME)).toBe(6);
  });

  it("no exhausted enemy unit: nothing is asked", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, WAMPA).Build());

    await attackWithRex(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
