import { describe, it, expect } from "vitest";
import { formatStep } from "@/server/puzzle/solver/format";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import type { GameDispatch } from "@/lib/engine/message-types";
import { randomUUID } from "crypto";

function dispatch(
  type: GameDispatch["dispatchType"],
  data: GameDispatch["dispatchData"],
): GameDispatch {
  return { dispatchId: randomUUID(), dispatchType: type, dispatchData: data, fromPlayer: 1 };
}

describe("formatStep", () => {
  const gs = new GameStateBuilder()
    .WithActivePlayer(1)
    .WithGamePhase("ActionPhase")
    .MyBase("SOR_022", 0)
    .MyLeader("SOR_014")
    .TheirBase("SOR_025", 0)
    .TheirLeader("SHD_014")
    .WithGroundUnitForPlayer(1, "SOR_095")
    .Build();

  it("formats play-card with card title", () => {
    const result = formatStep(
      dispatch("play-card", { cardId: "SOR_095", fromZone: "Hand" }),
      gs,
    );
    expect(result).toContain("Play");
    expect(result).toContain("Battlefield Marine"); // SOR_095 = Battlefield Marine
  });

  it("formats initiate-attack with attacker unit title", () => {
    const attackerPlayId = gs.player1.groundArena[0].playId;
    const result = formatStep(
      dispatch("initiate-attack", { playId: attackerPlayId }),
      gs,
    );
    expect(result).toContain("Attack with");
    expect(result).toContain("Battlefield Marine");
  });

  it("formats deploy leader", () => {
    const result = formatStep(
      dispatch("use-ability", { cardId: "SOR_014", deployLeader: true, epicAction: true }),
      gs,
    );
    expect(result).toContain("Deploy");
    expect(result).toContain("Sabine Wren"); // SOR_014 = Sabine Wren
  });

  it("formats use-ability for leader", () => {
    const result = formatStep(
      dispatch("use-ability", { cardId: "SOR_014" }),
      gs,
    );
    expect(result).toContain("Sabine Wren");
    expect(result).toContain("ability");
  });

  it("formats pass-action", () => {
    const result = formatStep(dispatch("pass-action", {}), gs);
    expect(result).toBe("Pass action");
  });

  it("formats choose-target with base", () => {
    const result = formatStep(
      dispatch("choose-target", { targetZones: ["Base"], targetPlayers: [2] }),
      gs,
    );
    expect(result).toContain("base");
  });

  it("formats choose-target with unit playId", () => {
    const playId = gs.player1.groundArena[0].playId;
    const result = formatStep(
      dispatch("choose-target", { targetPlayIds: [playId] }),
      gs,
    );
    expect(result).toContain("Battlefield Marine"); // SOR_095 = Battlefield Marine
  });

  it("formats choose-option", () => {
    const result = formatStep(
      dispatch("choose-option", { option: "deal_base_damage=1,3" }),
      gs,
    );
    expect(result).toContain("deal_base_damage=1,3");
  });

  it("formats play-smuggle with resource card title", () => {
    // Build a state with a resource in player 1's resources
    const gsWithResource = new GameStateBuilder()
      .WithActivePlayer(1)
      .WithGamePhase("ActionPhase")
      .MyBase("SOR_022", 0)
      .MyLeader("SOR_014")
      .TheirBase("SOR_025", 0)
      .TheirLeader("SHD_014")
      .FillResourcesForPlayer(1, "SOR_095", 1)
      .Build();

    const resourcePlayId = gsWithResource.player1.resources[0].playId;
    const result = formatStep(
      dispatch("play-smuggle", { playId: resourcePlayId }),
      gsWithResource,
    );
    expect(result).toContain("Smuggle");
    expect(result).toContain("Battlefield Marine"); // SOR_095 = Battlefield Marine
  });

  it("formats claim-initiative", () => {
    const result = formatStep(dispatch("claim-initiative", {}), gs);
    expect(result).toBe("Claim initiative");
  });

  it("formats choose-target with Leader zone", () => {
    const result = formatStep(
      dispatch("choose-target", { targetZones: ["Leader"], targetPlayers: [2] }),
      gs,
    );
    expect(result).toContain("leader");
  });

  it("formats choose-player", () => {
    const result = formatStep(
      dispatch("choose-player", { playerId: 2 }),
      gs,
    );
    expect(result).toContain("player 2");
  });
});
