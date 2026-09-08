import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// TWI_120 Strategic Acumen (Upgrade +0/+2, cost 1, Command, Learned) —
//   "Attached unit gains: 'Action [Exhaust]: Play a unit from your hand. It costs 1 resource less.'"
//
// The second upgrade-granted Action, and the counterpart to SHD_155: its cost IS [Exhaust], and it
// does NOT defeat the upgrade — so the host ends exhausted with Strategic Acumen still attached,
// reusable next round. Getting those two backwards is the whole risk here.

const ACUMEN = "TWI_120";
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3 -> 3/5 with the upgrade
const MID = "IBH_008";                             // Crix Madine, cost 3

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(ACUMEN, 1)])
    .WithActivePlayer(1);
}

const hostPlayId = (g: GameTestAdapter) => g.state.player1.groundArena[0].playId;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const useIt = (g: GameTestAdapter) =>
  g.dispatchAsync(1, "use-ability", { cardId: ACUMEN, playId: hostPlayId(g) });

describe("TWI_120 Strategic Acumen", () => {
  it("gives the attached unit +0/+2", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());
    const host = Unit.FromInterface(g.state.player1.groundArena[0]);

    expect(host.CurrentPower()).toBe(3);
    expect(host.TotalHP()).toBe(5); // 3 + 2
  });

  it("plays a unit from hand for 1 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, MID).Build());
    const before = readyResources(g);

    await useIt(g);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player1.groundArena.some(u => u.cardId === MID)).toBe(true);
    expect(readyResources(g)).toBe(before - 2); // cost 3 - 1
  });

  it("exhausts the host as its cost", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, MID).Build());

    await useIt(g);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("does NOT defeat the upgrade — it stays attached", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, MID).Build());

    await useIt(g);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toEqual([ACUMEN]);
  });

  it("an exhausted host cannot use it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 8)
        .WithGroundUnitForPlayer(1, MARINE, false) // exhausted
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(ACUMEN, 1)])
        .WithCardInHandForPlayer(1, MID)
        .WithActivePlayer(1)
        .Build(),
    );

    await useIt(g);

    expect(g.state.player1.groundArena.some(u => u.cardId === MID)).toBe(false);
  });

  it("a unit with no Strategic Acumen has no such Action", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 8)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, MID)
        .WithActivePlayer(1)
        .Build(),
    );

    await useIt(g);

    expect(g.state.player1.groundArena.some(u => u.cardId === MID)).toBe(false);
  });
});
