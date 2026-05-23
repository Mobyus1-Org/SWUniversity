import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_127 Strike True", () => {
  it("deals damage equal to attacker power to the chosen enemy unit", async () => {
    // Battlefield Marine is 3/3. Strike True should deal 3 damage to the target.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // Step 1: choose the friendly attacker (BFM at index 0)
    await g.chooseGroundUnitAsync(1, 0);
    // Step 2: choose the enemy target (P2 BFM at index 0)
    await g.chooseGroundUnitAsync(2, 0);

    // BFM has 3 power → target takes 3 damage; 3 HP - 3 = 0 → defeated
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(1); // attacker unharmed
  });

  it("does not defeat the enemy unit when damage is less than its HP", async () => {
    // BFM is 3/3. SPC (SOR_066) is 4/4. BFM (3 power) deals 3 damage to SPC (4 HP) → 1 HP left.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)  // 4 HP
      .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // Step 1: choose friendly BFM as attacker
    await g.chooseGroundUnitAsync(1, 0);
    // Step 2: choose enemy SPC
    await g.chooseSpaceUnitAsync(2, 0);

    // 3 damage to 4 HP → 1 HP remaining, not defeated
    expect(g.state.player2.spaceArena).toHaveLength(1);
    expect(g.state.player2.spaceArena[0].damage).toBe(3);
  });

  it("uses current power including Phase buffs", async () => {
    // BFM buffed to 4/3 via a Phase +1/+0 effect should deal 4 damage.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.strikeTrue)
      .WithCurrentEffect({ cardId: "SHD_008", duration: "Phase", affectedPlayer: 1, targetPlayId: "" })
      .Build();

    // Patch the Phase effect's targetPlayId to the friendly BFM's playId
    const bfmPlayId = state.player1.groundArena[0].playId;
    state.currentEffects[0].targetPlayId = bfmPlayId;

    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // buffed BFM (4 power)
    await g.chooseGroundUnitAsync(2, 0); // enemy BFM (3 HP)

    // 4 damage to a 3 HP unit → defeated
    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});
