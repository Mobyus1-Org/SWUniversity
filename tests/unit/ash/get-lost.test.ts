import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_067 Get Lost. Cost 4 Vigilance/Heroism Tactic event.
//   "Defeat an upgraded non-leader unit."
//
// "Upgraded" means carrying at least one upgrade, and a Shield TOKEN is an upgrade — so a unit
// holding nothing but a Shield is a legal target. Either player's units are eligible; leaders,
// however upgraded, are not.

const GET_LOST = Cards.events.ash.getLost;
const SHIELD = Cards.upgrades.token.shield;
const SABER = Cards.upgrades.sor.academyTraining;
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, GET_LOST);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? (res.fromPlayIds ?? []) : [];
};

describe("ASH_067 Get Lost", () => {
  it("defeats the chosen upgraded enemy unit, upgrade and all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SABER, 2)])
        .Build(),
    );
    const victim = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [victim] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.discard.some(c => c.cardId === SECURITY)).toBe(true);
    expect(g.state.player2.discard.some(c => c.cardId === SABER)).toBe(true);
  });

  it("counts a Shield TOKEN as an upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHIELD, 2)])
        .Build(),
    );
    const shielded = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(offered(g)).toContain(shielded);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [shielded] });
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("does not offer an unupgraded unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SABER, 2)])
        .WithGroundUnitForPlayer(2, MARINE) // bare
        .Build(),
    );
    const bare = g.state.player2.groundArena.find(u => u.cardId === MARINE)!.playId;

    await g.playCardFromHandAsync(1, 0);

    expect(offered(g)).not.toContain(bare);
  });

  it("can target a FRIENDLY upgraded unit — the text does not say enemy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, SECURITY)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(SABER, 1)])
        .Build(),
    );
    const own = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(offered(g)).toContain(own);
  });

  it("does not offer an upgraded deployed LEADER", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SABER, 2)])
        .FillResourcesForPlayer(2, MARINE, 14)
        .Build(),
    );
    g.state.activePlayer = 2;
    await g.deployLeaderAsync(2);
    await g.dispatchAsync(2, "pass-action", {});
    const leaderUnit = g.state.player2.groundArena.find(u => u.cardId !== SECURITY)!;
    // Give the deployed leader an upgrade so only the non-leader clause can exclude it.
    leaderUnit.upgrades.push({ cardId: SABER, playId: "leader-up", owner: 2, controller: 2 });

    await g.playCardFromHandAsync(1, 0);

    expect(offered(g)).not.toContain(leaderUnit.playId);
  });

  it("fizzles with no upgraded unit anywhere", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});
