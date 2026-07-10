import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { Cards } from "../../card-helpers";

// LOF_007 Avar Kriss — Marshal of Starlight (Leader)
// Front:  Action [Exhaust]: The Force is with you (create your Force token).
//         Epic Action: If resources you control + times you used the Force this phase >= 9, deploy.
// Deployed: While the Force is with you, this unit gets +4/+0 and gains Overwhelm.

describe("LOF_007 Avar Kriss — front side", () => {
  it("Action [Exhaust]: creates the Force token and exhausts the leader", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.avarKriss)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .Build();
    g.loadNewState(state);

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.leaders.lof.avarKriss });

    expect(g.state.player1.supplemental.forceToken).toBe(true);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("counts times the Force is used this phase (roundState.forceUsedThisPhase)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance, for Cure Wounds
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.lof.cureWounds)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 6)
      .Build();
    state.player1.supplemental.forceToken = true;
    g.loadNewState(state);

    expect(g.state.roundState.forceUsedThisPhase).toBe(0);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes"); // Use the Force
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [state.player1.groundArena[0].playId] });

    expect(g.state.roundState.forceUsedThisPhase).toBe(1);
  });

  it("Epic Action: deploys when resources controlled reach 9", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.avarKriss)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 9)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.lof.avarKriss)).toBe(true);
  });

  it("Epic Action: does not deploy when resources + Force uses < 9", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.avarKriss)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .Build();
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });

  it("Epic Action: counts Force uses toward the 9 threshold", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.avarKriss)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .Build();
    state.roundState.forceUsedThisPhase = 2; // 7 + 2 = 9
    g.loadNewState(state);

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
  });
});

describe("LOF_007 Avar Kriss — deployed side", () => {
  function deployedLeader(g: GameTestAdapter): Unit {
    const iface = g.state.player1.groundArena.find(u => u.cardId === Cards.leaders.lof.avarKriss)!;
    return Unit.FromInterface(iface);
  }

  async function buildDeployed(): Promise<GameTestAdapter> {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.lof.avarKriss)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 9)
      .Build();
    g.loadNewState(state);
    await g.deployLeaderAsync(1);
    return g;
  }

  it("gets +4/+0 while the Force is with you", async () => {
    const g = await buildDeployed();

    g.state.player1.supplemental.forceToken = false;
    expect(deployedLeader(g).CurrentPower()).toBe(4); // base power

    g.state.player1.supplemental.forceToken = true;
    expect(deployedLeader(g).CurrentPower()).toBe(8); // +4
  });

  it("gains Overwhelm while the Force is with you", async () => {
    const g = await buildDeployed();
    const unit = g.state.player1.groundArena.find(u => u.cardId === Cards.leaders.lof.avarKriss)!;

    g.state.player1.supplemental.forceToken = false;
    expect(HasOverwhelm(unit.cardId, unit.playId, 1)).toBe(false);

    g.state.player1.supplemental.forceToken = true;
    expect(HasOverwhelm(unit.cardId, unit.playId, 1)).toBe(true);
  });
});
