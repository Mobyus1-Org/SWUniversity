import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
import { Unit } from "@/server/engine/unit";

// TS26_07 Asajj Ventress — Ambitious Apprentice (Leader, Cunning/Villainy; unit side 3/5 Ground)
//   Front: "Action [Exhaust]: Attack with a token unit. It gets +1/+0 for this attack.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "Hidden. While you've attacked with a token unit this phase, this unit gets +2/+0."

const ASAJJ = Cards.leaders.ts26.asajjVentress;
const DROID = Cards.units.token.battleDroid; // 1/1
const MARINE = Cards.units.sor.battlefieldMarine;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(ASAJJ)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 8);
}

describe("TS26_07 Asajj Ventress — leader Action", () => {
  it("attacks with a ready friendly token unit at +1/+0 for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, DROID).WithGroundUnitForPlayer(1, DROID, false)
      .WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, DROID).Build());
    const readyDroid = g.state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type === "Target" ? res.fromPlayIds : []).toEqual([readyDroid]); // not exhausted, enemy or non-token
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [readyDroid] });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(1); // this attack only
  });

  it("not available without a ready friendly token unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, DROID, false).Build());

    expect(ActionAbilities(ASAJJ, 1)).not.toContain(ASAJJ);
  });
});

describe("TS26_07 Asajj Ventress — deployed", () => {
  async function deployed(g: GameTestAdapter) {
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
  }
  const asajj = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === ASAJJ)!;

  it("has Hidden", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    await deployed(g);

    expect(HasHidden(ASAJJ, asajj(g).playId, 1)).toBe(true);
  });

  it("+2/+0 once you've attacked with a token unit this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, DROID).Build());
    await deployed(g);
    expect(Unit.FromInterface(asajj(g)).CurrentPower()).toBe(3);

    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === DROID));
    await g.chooseBaseAsync(1, 2);

    expect(Unit.FromInterface(asajj(g)).CurrentPower()).toBe(5);
  });

  it("a non-token attack, or an enemy token's, doesn't count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, DROID).Build());
    await deployed(g);

    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === MARINE));
    await g.chooseBaseAsync(1, 2);
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.roundState.unitsAttackedThisPhase).toHaveLength(2);
    expect(Unit.FromInterface(asajj(g)).CurrentPower()).toBe(3);
  });
});
