import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { ADVANTAGE_TOKEN } from "@/server/engine/token-helpers";
import { Cards } from "../../card-helpers";

// ASH_257 Choose Your Path (Event, cost 2)
// "Choose one:
//  If you control a Force unit, heal 5 damage from your base.
//  If you control a Mandalorian unit, create a Mandalorian token and give an Advantage token to it."

const MANDALORIAN_TOKEN = "ASH_T01";

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 8) // 8 damage to heal from
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_257 Choose Your Path", () => {
  it("heals 5 from your base when you control a Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.chooseYourPath)
        .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq) // Force, Jedi
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "heal");

    expect(g.state.player1.base.damage).toBe(3); // 8 - 5
  });

  it("creates a Mandalorian token with an Advantage token when you control a Mandalorian", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.chooseYourPath)
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianScout) // Mandalorian
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "mandalorian");

    const token = g.state.player1.groundArena.find(u => u.cardId === MANDALORIAN_TOKEN)!;
    expect(token).toBeDefined();
    expect(token.upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(1);
    expect(g.state.player1.base.damage).toBe(8); // the other mode did not fire
  });

  it("offers only the Force mode when you control no Mandalorian", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.chooseYourPath)
        .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { type: string; options?: string[] };
    expect(res.type).toBe("Option");
    expect(res.options).toEqual(["heal"]);
  });

  it("offers only the Mandalorian mode when you control no Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.chooseYourPath)
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianScout)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { options?: string[] };
    expect(res.options).toEqual(["mandalorian"]);
  });

  it("offers both modes when you control a Force unit and a Mandalorian", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.chooseYourPath)
        .WithGroundUnitForPlayer(1, Cards.units.ash.kelleranBeq)
        .WithGroundUnitForPlayer(1, Cards.units.ash.mandalorianScout)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { options?: string[] };
    expect(res.options).toEqual(["heal", "mandalorian"]);
  });

  it("does nothing when you control neither a Force nor a Mandalorian unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.chooseYourPath)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel, Trooper
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(8);
    expect(g.state.player1.groundArena).toHaveLength(1);
  });

  it("is not enabled by an ENEMY Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.chooseYourPath)
        .WithGroundUnitForPlayer(2, Cards.units.ash.kelleranBeq)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(8);
  });
});
