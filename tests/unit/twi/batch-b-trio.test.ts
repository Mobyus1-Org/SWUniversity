import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   TWI_139 Corner the Prey — "Attack with a unit. It gets +1/+0 for this attack for each damage
//                              on the defender at the start of this attack."
//   TWI_110 Huyang          — "When Played: Choose another friendly unit. While THIS unit is in
//                              play, the chosen unit gets +2/+2."
//   SHD_208 Final Showdown  — "Ready each unit you control. At the start of the regroup phase, you
//                              lose the game."

const CORNER = Cards.events.twi.cornerThePrey;
const HUYANG = Cards.units.twi.huyang;
const SHOWDOWN = Cards.events.shd.finalShowdown;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId);
};

describe("TWI_139 Corner the Prey", () => {
  it("adds +1/+0 per damage marker already on the defender", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CORNER)
        .WithGroundUnitForPlayer(1, MARINE)     // 3 power
        .WithGroundUnitForPlayer(2, SECURITY)   // 3/7
        .Build(),
    );
    find(g, 2, SECURITY)!.damage = 1;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE)!.playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY)!.playId] });

    // 1 existing + (3 power + 1 bonus) = 5. Without the bonus it would read 4.
    expect(find(g, 2, SECURITY)!.damage).toBe(5);
  });

  it("adds nothing against an undamaged defender", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CORNER)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE)!.playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SECURITY)!.playId] });

    expect(find(g, 2, SECURITY)!.damage).toBe(3);
  });

  it("the bonus is for this attack only", async () => {
    // A 3/7 attacker so it survives the counter and can still be measured afterwards.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, CORNER)
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );
    g.state.player2.groundArena[0].damage = 1;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(5); // 1 + 3 + 1 bonus
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3);
  });
});

describe("TWI_110 Huyang — Enduring Instructor", () => {
  it("gives the chosen other friendly unit +2/+2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, HUYANG).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE)!.playId] });

    const buffed = Unit.FromInterface(find(g, 1, MARINE)!);
    expect(buffed.CurrentPower()).toBe(5);
    expect(buffed.TotalHP()).toBe(5);
  });

  it("the buff goes away when Huyang leaves play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, HUYANG).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE)!.playId] });
    expect(Unit.FromInterface(find(g, 1, MARINE)!).CurrentPower()).toBe(5);

    // Remove Huyang from the board; the grant is conditional on him being there.
    const idx = g.state.player1.groundArena.findIndex(u => u.cardId === HUYANG);
    g.state.player1.groundArena.splice(idx, 1);

    expect(Unit.FromInterface(find(g, 1, MARINE)!).CurrentPower()).toBe(3);
  });

  it("cannot choose himself, and offers nothing when he is alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, HUYANG).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(Unit.FromInterface(find(g, 1, HUYANG)!).CurrentPower()).toBe(2);
  });
});

describe("SHD_208 Final Showdown", () => {
  it("readies every unit you control, and not the opponent's", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, SHOWDOWN)
        .WithGroundUnitForPlayer(1, MARINE, false)   // exhausted
        .WithGroundUnitForPlayer(1, SECURITY, false)
        .WithGroundUnitForPlayer(2, MARINE, false)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.every(u => u.ready)).toBe(true);
    expect(g.state.player2.groundArena[0].ready).toBe(false);
  });

  it("makes the caster lose at the start of the regroup phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, SHOWDOWN).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.state.defeatedPlayers ?? []).toHaveLength(0); // not yet

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.defeatedPlayers).toContain(1);
    expect(g.state.defeatedPlayers).not.toContain(2);
  });
});
