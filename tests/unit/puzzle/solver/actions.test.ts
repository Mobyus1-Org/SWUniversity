import { describe, it, expect } from "vitest";
import { getTopLevelActions, getResolutionActions } from "@/server/puzzle/solver/actions";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import type { NeedsOption, NeedsTarget, NeedsDeckSearch, NeedsPlot } from "@/lib/engine/message-types";
import type { PlayerId } from "@/lib/engine/core-models";

describe("getTopLevelActions", () => {
  it("returns only pass-action when active player is 2", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(2)
      .WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0)
      .MyLeader("SOR_014")
      .TheirBase("SOR_025", 0)
      .TheirLeader("SHD_014")
      .Build();

    const actions = getTopLevelActions(gs);

    expect(actions).toHaveLength(1);
    expect(actions[0].dispatchType).toBe("pass-action");
    expect(actions[0].fromPlayer).toBe(2);
  });

  it("includes initiate-attack for each ready player 1 unit", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1)
      .WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0)
      .MyLeader("SOR_014", false, false, true) // epicActionUsed=true to simplify
      .TheirBase("SOR_025", 0)
      .TheirLeader("SHD_014")
      .WithGroundUnitForPlayer(1, "SOR_095") // ready
      .WithSpaceUnitForPlayer(1, "SOR_141")   // ready
      .WithGroundUnitForPlayer(1, "SOR_095", false) // exhausted — should be excluded
      .Build();

    const actions = getTopLevelActions(gs);

    const attackDispatches = actions.filter(a => a.dispatchType === "initiate-attack");
    expect(attackDispatches).toHaveLength(2); // only the 2 ready units
  });

  it("includes play-card for affordable cards in hand", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1)
      .WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0)
      .MyLeader("SOR_014", false, false, true)
      .TheirBase("SOR_025", 0)
      .TheirLeader("SHD_014")
      .FillResourcesForPlayer(1, "SOR_095", 3) // 3 ready resources
      .WithCardInHandForPlayer(1, "SOR_095")    // costs 2 — affordable with 3 resources
      .WithCardInHandForPlayer(1, "SOR_001")    // costs 5 + aspect penalty — not affordable with 3 resources
      .Build();

    const actions = getTopLevelActions(gs);

    const playDispatches = actions.filter(a => a.dispatchType === "play-card");
    expect(playDispatches).toHaveLength(1);
    expect((playDispatches[0].dispatchData as { cardId: string }).cardId).toBe("SOR_095");
  });

  it("includes leader ability when not epicActionUsed", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1)
      .WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0)
      .MyLeader("SOR_014", true, false, false) // ready, not deployed, epicActionUsed=false
      .TheirBase("SOR_025", 0)
      .TheirLeader("SHD_014")
      .Build();

    const actions = getTopLevelActions(gs);

    const abilityDispatches = actions.filter(a => a.dispatchType === "use-ability");
    expect(abilityDispatches.length).toBeGreaterThanOrEqual(1);
  });

  it("always includes pass-action for player 1", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1)
      .WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0)
      .MyLeader("SOR_014", false, false, true)
      .TheirBase("SOR_025", 0)
      .TheirLeader("SHD_014")
      .Build();

    const actions = getTopLevelActions(gs);

    expect(actions.some(a => a.dispatchType === "pass-action")).toBe(true);
  });
});

describe("getResolutionActions", () => {
  it("returns one choose-target per fromPlayId", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1)
      .WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0)
      .MyLeader("SOR_014")
      .TheirBase("SOR_025", 0)
      .TheirLeader("SHD_014")
      .Build();

    const resolution: NeedsTarget = {
      type: "Target",
      fromPlayIds: ["unit-1", "unit-2"],
    };

    const actions = getResolutionActions(resolution, gs);

    const targetDispatches = actions.filter(a => a.dispatchType === "choose-target");
    expect(targetDispatches).toHaveLength(2);
  });

  it("returns one choose-option per option string", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1)
      .WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0)
      .MyLeader("SOR_014")
      .TheirBase("SOR_025", 0)
      .TheirLeader("SHD_014")
      .Build();

    const resolution: NeedsOption = {
      type: "Option",
      helperText: "Choose one:",
      options: ["deal_base_damage=1,3", "player_discards_from_hand=1,1"],
    };

    const actions = getResolutionActions(resolution, gs);

    expect(actions).toHaveLength(2);
    expect(actions[0].dispatchType).toBe("choose-option");
    expect((actions[0].dispatchData as { option: string }).option).toBe("deal_base_damage=1,3");
  });

  it("returns two choose-target dispatches for Base zone (one per player)", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1).WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0).MyLeader("SOR_014")
      .TheirBase("SOR_025", 0).TheirLeader("SHD_014")
      .Build();

    const resolution: NeedsTarget = {
      type: "Target",
      fromZones: ["Base"],
    };

    const actions = getResolutionActions(resolution, gs);

    const baseTargets = actions.filter(a => a.dispatchType === "choose-target");
    expect(baseTargets).toHaveLength(2);
    const players = baseTargets.map(a => (a.dispatchData as { targetPlayers: number[] }).targetPlayers[0]);
    expect(players).toContain(1);
    expect(players).toContain(2);
  });

  it("returns a single continue dispatch for DeckSearch", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1).WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0).MyLeader("SOR_014")
      .TheirBase("SOR_025", 0).TheirLeader("SHD_014")
      .Build();

    const resolution: NeedsDeckSearch = {
      type: "DeckSearch",
      helperText: "Search your deck",
      choices: [],
      action: "play",
    };

    const actions = getResolutionActions(resolution, gs);

    expect(actions).toHaveLength(1);
    expect(actions[0].dispatchType).toBe("choose-target");
    expect((actions[0].dispatchData as { targetPlayIds: string[] }).targetPlayIds).toEqual([]);
  });

  it("returns one dispatch per plot playId plus a pass-action", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1).WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0).MyLeader("SOR_014")
      .TheirBase("SOR_025", 0).TheirLeader("SHD_014")
      .Build();

    const resolution: NeedsPlot = {
      type: "Plot",
      fromPlayIds: ["plot-1", "plot-2"],
    };

    const actions = getResolutionActions(resolution, gs);

    expect(actions).toHaveLength(3); // 2 targets + 1 pass
    expect(actions.filter(a => a.dispatchType === "choose-target")).toHaveLength(2);
    expect(actions.some(a => a.dispatchType === "pass-action")).toBe(true);
  });

  it("returns one choose-player per player in fromPlayers", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1).WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0).MyLeader("SOR_014")
      .TheirBase("SOR_025", 0).TheirLeader("SHD_014")
      .Build();

    const resolution = {
      type: "Player" as const,
      fromPlayers: [1, 2] as PlayerId[],
    };

    const actions = getResolutionActions(resolution, gs);

    expect(actions).toHaveLength(2);
    expect(actions.every(a => a.dispatchType === "choose-player")).toBe(true);
  });

  it("returns one choose-trigger per cardId in fromCardIds", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1).WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0).MyLeader("SOR_014")
      .TheirBase("SOR_025", 0).TheirLeader("SHD_014")
      .Build();

    const resolution = {
      type: "Trigger" as const,
      fromCardIds: ["SOR_095", "SOR_141"],
    };

    const actions = getResolutionActions(resolution, gs);

    expect(actions).toHaveLength(2);
    expect(actions.every(a => a.dispatchType === "choose-trigger")).toBe(true);
  });

  it("returns per-unit dispatches for SpreadDamage, plus base when includesBase", () => {
    const gs = new GameStateBuilder()
      .WithActivePlayer(1).WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0).MyLeader("SOR_014")
      .TheirBase("SOR_025", 0).TheirLeader("SHD_014")
      .Build();

    const resolution = {
      type: "SpreadDamage" as const,
      totalDamage: 4,
      optional: false,
      eligiblePlayIds: ["unit-1", "unit-2"],
      includesBase: true,
    };

    const actions = getResolutionActions(resolution, gs);

    // 2 per-unit + 1 base = 3 total
    expect(actions).toHaveLength(3);
    expect(actions.every(a => a.dispatchType === "choose-target")).toBe(true);
    // One assigns all 4 damage to unit-1
    const allToFirst = actions.find(a => {
      const d = a.dispatchData as { spreadDamageAssignments: { playId: string; damage: number }[] };
      return d.spreadDamageAssignments?.find(x => x.playId === "unit-1")?.damage === 4;
    });
    expect(allToFirst).toBeDefined();
    // One assigns all 4 damage to the base
    const baseDispatch = actions.find(a => {
      const d = a.dispatchData as { spreadDamageAssignments: { playId: string; damage: number }[] };
      return d.spreadDamageAssignments?.find(x => x.playId === "player2.base")?.damage === 4;
    });
    expect(baseDispatch).toBeDefined();
  });
});
