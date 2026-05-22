import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { Unit } from "@/server/engine/unit";

// Qi'ra (SHD_002): 8 HP, 0 base power, Grit
// Battlefield Marine (SOR_095): 3 HP → floor(3/2) = 1 damage from Qi'ra's deploy
// Qi'ra's deploy deals floor(8/2) = 4 to herself

function qiraSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.shd.qira)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10);
}

describe("Qi'ra When Deployed", () => {
  it("deals floor(HP/2) damage to enemy ground unit with 0 initial damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      qiraSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );
    await g.deployLeaderAsync(1);
    expect(g.state.player2.groundArena[0].damage).toBe(1); // floor(3/2)=1
    expect(g.state.player1.groundArena[0].damage).toBe(4); // floor(8/2)=4
  });

  it("heals pre-existing damage before dealing half-HP damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      qiraSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2)
        .Build(),
    );
    await g.deployLeaderAsync(1);
    // healed from 2 → 0, then dealt floor(3/2)=1 — not 2+1=3
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("shield token absorbs damage on enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      qiraSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2)])
        .Build(),
    );
    await g.deployLeaderAsync(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].upgrades.length).toBe(0); // shield consumed
  });

  it("deals half-HP damage to enemy unit in space arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      qiraSetup()
        .WithSpaceUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );
    await g.deployLeaderAsync(1);
    expect(g.state.player2.spaceArena[0].damage).toBe(1); // floor(3/2)=1
    expect(g.state.player1.groundArena[0].damage).toBe(4); // Qi'ra hits herself
  });

  it("deals half-HP damage to friendly units in play as well", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      qiraSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // friendly marine
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy marine
        .Build(),
    );
    await g.deployLeaderAsync(1);
    // friendly marine at index 0 (Qi'ra deploys as index 1 since marine was first)
    expect(g.state.player1.groundArena[0].damage).toBe(1); // marine floor(3/2)=1
    expect(g.state.player2.groundArena[0].damage).toBe(1); // enemy marine floor(3/2)=1
  });

  it("Qi'ra takes floor(HP/2) damage from her own deploy when no other units are present", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(qiraSetup().Build());
    await g.deployLeaderAsync(1);
    expect(g.state.player1.groundArena[0].damage).toBe(4); // floor(8/2)=4
  });

  it("Qi'ra has currentPower 4 from Grit after taking 4 damage on deploy", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(qiraSetup().Build());
    await g.deployLeaderAsync(1);
    const qira = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(qira.damage).toBe(4);
    expect(qira.CurrentPower()).toBe(4); // 0 base + 4 Grit
  });
});
