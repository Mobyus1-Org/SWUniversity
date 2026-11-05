import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LAW_202 Commence the Festivities (Event, cost 1, Aggression)
//   "Attack with a unit. It gains Saboteur for this attack. If you control fewer resources than an
//    opponent, it gets +2/+0 for this attack."

const COMMENCE = Cards.events.law.commenceTheFestivities;
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const GUARD = Cards.units.sor.cellBlockGuard;       // 3/3 Sentinel
const WAMPA = Cards.units.sor.wampa;                // 4/5
const SHIELD = Cards.upgrades.token.shield;

function board(myResources: number, theirResources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, myResources)
    .FillResourcesForPlayer(2, MARINE, theirResources)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithCardInHandForPlayer(1, COMMENCE);
}

async function sendInTheMarine(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
}

describe("LAW_202 Commence the Festivities", () => {
  it("with fewer resources than the opponent, the attacker gets +2/+0 for this attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5, 8).Build());

    await sendInTheMarine(g);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3); // this attack only
  });

  it("control: with as many resources as the opponent, no +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(8, 8).Build());

    await sendInTheMarine(g);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("Saboteur: it may attack the base past a Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(8, 8).WithGroundUnitForPlayer(2, GUARD).Build());

    await sendInTheMarine(g);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("Saboteur: it defeats the defender's Shields", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board(8, 8).WithGroundUnitForPlayer(2, WAMPA)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHIELD, 2)]).Build(),
    );

    await sendInTheMarine(g);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    const wampa = g.state.player2.groundArena[0];
    expect(wampa.upgrades.map(u => u.cardId)).not.toContain(SHIELD);
    expect(wampa.damage).toBe(3);
  });

  it("control: an ordinary attack is stopped by the Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(8, 8).WithGroundUnitForPlayer(2, GUARD).Build());
    g.state.player1.hand = [];

    await g.attackWithGroundUnitAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded;

    expect(res?.type === "Target" ? res.fromZones ?? [] : []).not.toContain("Base");
  });
});
