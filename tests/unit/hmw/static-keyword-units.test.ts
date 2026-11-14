import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasGrit } from "@/server/engine/card-db/keyword-dictionaries.ts/grit";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// Static keyword / stat cards from HMW:
//   HMW_090 Opee Sea Killer — "While you control a Naboo base, this unit gains Grit."
//   HMW_117 Chewbacca (Resourceful Wookiee) — "This unit gains Raid 1 for each exhausted resource you
//           control. While each resource you control is exhausted, this unit gains Overwhelm."
//   HMW_133 Wroshyr Rebel — "This unit gets +1/+0 for every 2 resources you control."
//   HMW_112 Military Academy — "Fortify. Attached base gains: Friendly units gain Overwhelm."

const OPEE = Cards.units.hmw.opeeSeaKiller;
const CHEWIE = Cards.units.hmw.chewbaccaResourcefulWookiee;
const WROSHYR = Cards.units.hmw.wroshyrRebel;
const ACADEMY = Cards.upgrades.hmw.militaryAcademy;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7

function board(myBase: string = Cards.bases.common.blue30HP) {
  return new GameStateBuilder()
    .MyBase(myBase)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

function load(state: ReturnType<GameStateBuilder["Build"]>) {
  const g = new GameTestAdapter();
  g.loadNewState(state);
  return g;
}

describe("HMW_090 Opee Sea Killer", () => {
  it("has Grit with a Naboo base: +1/+0 per damage", () => {
    const g = load(board(Cards.bases.hmw.greatGrassPlains).WithGroundUnitForPlayer(1, OPEE, true, 2).Build());
    const opee = g.state.player1.groundArena[0];
    expect(HasGrit(OPEE, opee.playId, 1)).toBe(true);
    expect(Unit.FromInterface(opee).CurrentPower()).toBe(5 + 2);
  });

  it("has no Grit without one", () => {
    const g = load(board(Cards.bases.hmw.duneSea).WithGroundUnitForPlayer(1, OPEE, true, 2).Build());
    const opee = g.state.player1.groundArena[0];
    expect(HasGrit(OPEE, opee.playId, 1)).toBe(false);
    expect(Unit.FromInterface(opee).CurrentPower()).toBe(5);
  });
});

describe("HMW_094 Sando Aqua Monster — printed Grit", () => {
  it("has Grit regardless of base", () => {
    expect(HasGrit(Cards.units.hmw.sandoAquaMonster)).toBe(true);
  });
});

describe("HMW_117 Chewbacca — Resourceful Wookiee", () => {
  function chewie(ready: number, exhausted: number) {
    const state = board().FillResourcesForPlayer(1, MARINE, ready + exhausted).WithGroundUnitForPlayer(1, CHEWIE).Build();
    state.player1.resources.slice(0, exhausted).forEach(r => { r.ready = false; });
    const g = load(state);
    return { g, playId: g.state.player1.groundArena[0].playId };
  }

  it("gains Raid 1 per exhausted resource", () => {
    const { playId } = chewie(2, 3);
    expect(RaidAmount(CHEWIE, playId, 1)).toBe(3);
  });

  it("has no Overwhelm while any resource is ready", () => {
    const { g, playId } = chewie(1, 3);
    expect(HasOverwhelm(CHEWIE, playId, 1, g.state.player2.groundArena[0]?.playId, 2)).toBeFalsy();
  });

  it("gains Overwhelm once every resource is exhausted", () => {
    const { playId } = chewie(0, 4);
    expect(HasOverwhelm(CHEWIE, playId, 1)).toBe(true);
  });

  it("attacking a unit with all 4 resources exhausted: 0 + Raid 4 power, excess spills to the base", async () => {
    const state = board().FillResourcesForPlayer(1, MARINE, 4).WithGroundUnitForPlayer(1, CHEWIE).WithGroundUnitForPlayer(2, Cards.units.hmw.grandArmyMarine).Build();
    state.player1.resources.forEach(r => { r.ready = false; });
    const g = load(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena.length).toBe(0); // 4 into a 2/2
    expect(g.state.player2.base.damage).toBe(2);         // Overwhelm excess
  });
});

describe("HMW_133 Wroshyr Rebel", () => {
  it("gets +1/+0 for every 2 resources, rounded down, exhausted ones included", () => {
    const state = board().FillResourcesForPlayer(1, MARINE, 5).WithGroundUnitForPlayer(1, WROSHYR).Build();
    state.player1.resources[0].ready = false;
    const g = load(state);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(2); // 0 + floor(5/2)
  });

  it("with 1 resource is 0 power", () => {
    const g = load(board().FillResourcesForPlayer(1, MARINE, 1).WithGroundUnitForPlayer(1, WROSHYR).Build());
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(0);
  });
});

describe("HMW_112 Military Academy", () => {
  const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

  it("friendly units gain Overwhelm while it is on your base", async () => {
    const g = load(
      board()
        .WithUpgradesOnBaseForPlayer(1, [up(ACADEMY, 1)])
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, Cards.units.hmw.grandArmyMarine) // 2/2
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.base.damage).toBe(1); // 3 into a 2/2 → 1 excess
  });

  it("does not grant Overwhelm to ENEMY units", () => {
    const g = load(
      board()
        .WithUpgradesOnBaseForPlayer(1, [up(ACADEMY, 1)])
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );
    expect(HasOverwhelm(CSF, g.state.player2.groundArena[0].playId, 2)).toBeFalsy();
  });

  it("control: without it, no Overwhelm", async () => {
    const g = load(
      board()
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, Cards.units.hmw.grandArmyMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.base.damage).toBe(0);
  });
});
