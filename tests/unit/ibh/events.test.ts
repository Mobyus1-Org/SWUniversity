import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH event reprints. Each is a Tactic/Innate/Disaster event.
function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("IBH_066 Too Strong for Blasters — Heal 2 from a unit", () => {
  it("heals 2 damage from the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.ibh.tooStrongForBlasters)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 3) // 3 damage
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena[0].damage).toBe(1); // 3 - 2
  });
});

describe("IBH_061 We're In Trouble — Deal 3 to a unit", () => {
  it("deals 3 to the chosen unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.ibh.wereInTrouble)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4 HP survives
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });
});

describe("IBH_059 Target the Main Generator — Deal 2 to a base", () => {
  it("deals 2 to the chosen base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, Cards.events.ibh.targetTheMainGenerator).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(2);
  });
});

describe("IBH_005 I'll Cover For You — 1 to an enemy unit and 1 to another enemy unit", () => {
  it("deals 1 to two different enemy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.ibh.illCoverForYou)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(2, 1);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.groundArena[1].damage).toBe(1);
  });
});

describe("IBH_021 Improvised Detonation — Attack with a unit +2/+0", () => {
  it("the chosen unit attacks with +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.ibh.improvisedDetonation)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(5); // 3 + 2
  });
});

describe("IBH_095 You Have Failed Me — Defeat a friendly unit, ready a friendly unit (≤5 power)", () => {
  it("defeats the chosen friendly unit and readies another", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.ibh.youHaveFailedMe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // sacrifice (idx 0)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false) // exhausted, power 3 (idx 1)
        .Build(),
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // defeat this one
    await g.chooseGroundUnitAsync(1, 0); // the survivor (now idx 0) to ready

    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });
});

describe("IBH_104 The Desolation of Hoth — Defeat up to 2 enemy units (cost ≤3)", () => {
  it("defeats two chosen enemy units costing 3 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.ibh.theDesolationOfHoth)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // cost 2
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // cost 2
        .Build(),
    );
    const s = g.state;
    const id1 = s.player2.groundArena[0].playId;
    const id2 = s.player2.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [id1, id2] });

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("control: an enemy unit costing >3 is not eligible (no prompt, survives)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.ibh.theDesolationOfHoth)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.devastator) // cost 10 — not eligible
        .Build(),
    );
    const after = await g.playCardFromHandAsync(1, 0);
    // No cost-≤3 enemy unit exists → the event has no legal target and fizzles.
    expect(after.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.spaceArena).toHaveLength(1); // Devastator survives
  });
});
