import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_037 Supreme Leader Snoke - Shadow Ruler (6/6 Ground, cost 8) —
//   "Each enemy non-leader unit gets –2/–2."
describe("SHD_037 Supreme Leader Snoke - Shadow Ruler", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Villainy/Vigilance — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gives each enemy non-leader unit -2/-2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.shd.supremeLeaderSnoke)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9
        .WithSpaceUnitForPlayer(2, Cards.units.sor.devastator)            // 10/10 — other arena still counts
        .Build(),
    );

    const walker = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(walker.CurrentPower()).toBe(4); // 6 - 2
    expect(walker.TotalHP()).toBe(7);      // 9 - 2

    // Snoke is a GROUND unit but his aura is not arena-limited.
    const devastator = Unit.FromInterface(g.state.player2.spaceArena[0]);
    expect(devastator.CurrentPower()).toBe(8);
    expect(devastator.TotalHP()).toBe(8);
  });

  it("does not affect FRIENDLY units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.shd.supremeLeaderSnoke)
        .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker)
        .Build(),
    );

    const friendly = Unit.FromInterface(g.state.player1.groundArena[1]);
    expect(friendly.CurrentPower()).toBe(6);
    expect(friendly.TotalHP()).toBe(9);
  });

  it("does not affect an enemy LEADER unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .TheirLeader(Cards.leaders.sor.sabineWren, true, true)
        .WithGroundUnitForPlayer(1, Cards.units.shd.supremeLeaderSnoke)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren) // deployed enemy leader
        .Build(),
    );

    const enemyLeader = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(enemyLeader.CurrentPower()).toBe(2); // Sabine's printed 2/5, undebuffed
    expect(enemyLeader.TotalHP()).toBe(5);
  });

  it("control: without Snoke the same enemy unit keeps its printed stats", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .Build(),
    );

    const walker = Unit.FromInterface(g.state.player2.groundArena[0]);
    expect(walker.CurrentPower()).toBe(6);
    expect(walker.TotalHP()).toBe(9);
  });

  it("stops applying once Snoke leaves play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.shd.supremeLeaderSnoke)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker)
        .WithCardInHandForPlayer(2, Cards.events.shd.rivalsFall)
        .WithActivePlayer(2)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(4);

    await g.playCardFromHandAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0); // Rival's Fall on Snoke

    expect(g.state.player1.groundArena.length).toBe(0);
    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(6);
  });

  it("the -2/-2 defeats an enemy unit whose damage already exceeds its reduced HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2) // 3/3 with 2 damage
        .WithCardInHandForPlayer(1, Cards.units.shd.supremeLeaderSnoke)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // Marine's HP drops to 1, below its 2 damage → swept when Snoke lands.
    expect(g.state.player2.groundArena.length).toBe(0);
  });
});
