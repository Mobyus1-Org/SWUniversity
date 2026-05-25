import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

const BASE = "__base__";

// Fennec Shand (SHD_016) has Cunning — covers JTL_234's aspect at exact cost 3.
const CUNNING_LEADER = Cards.leaders.shd.fennecShand;

describe("JTL_234 Torpedo Barrage", () => {
  it("prompts source player to choose a target player before assignment", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(CUNNING_LEADER)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithActivePlayer(1)
      .WithInitiativePlayerBeing(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Option");
    expect(resolution?.type === "Option" && resolution.options).toContain("Opponent");
    expect(resolution?.type === "Option" && resolution.options).toContain("Yourself");
  });

  it("deals 5 indirect damage all to opponent's base", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(CUNNING_LEADER)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithActivePlayer(1)
      .WithInitiativePlayerBeing(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [{ playId: BASE, damage: 5 }],
    });

    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("should assign indirect damage to self to their Grit unit to buff it, then attacks for more", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithActivePlayer(1)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
      .WithGroundUnitForPlayer(1, Cards.units.lof.sandtrooperCavalry)
      .Build();
    g.loadNewState(s);

    const cavalryPlayId = s.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Yourself" });

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("SpreadDamage");
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: cavalryPlayId, damage: 5 },
      ],
    });

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(7);
    expect(g.state.player1.groundArena[0].damage).toBe(5);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("indirect damage can defeat a unit (no shield bypass applies here)", async () => {
    // Assign 3 of the 5 damage to a 3/3 Battlefield Marine → exactly lethal → unit is defeated
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(CUNNING_LEADER)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithActivePlayer(1)
      .WithInitiativePlayerBeing(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
      .Build();
    g.loadNewState(s);

    const marinePlayId = s.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [
        { playId: marinePlayId, damage: 3 },
        { playId: BASE, damage: 2 },
      ],
    });

    expect(g.state.player2.groundArena.find(u => u.playId === marinePlayId)).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("rejects assigning more damage to a unit than its remaining HP", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(CUNNING_LEADER)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithActivePlayer(1)
      .WithInitiativePlayerBeing(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.jtl.torpedoBarrage)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
      .Build();
    g.loadNewState(s);

    const marinePlayId = s.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

    // Assign 4 to a 3-HP marine (over-cap) — should be rejected
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [
        { playId: marinePlayId, damage: 4 },
        { playId: BASE, damage: 1 },
      ],
    });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
