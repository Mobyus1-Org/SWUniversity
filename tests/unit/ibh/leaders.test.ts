import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// IBH_053 Darth Vader — "Action [1 resource, Exhaust]: Deal 1 damage to a base."
//                        "Epic Action: If you control 6 or more resources, deploy this leader."
// IBH_001 Leia Organa — "Action [1 resource, Exhaust]: Heal 1 damage from a friendly unit."
//                        "Epic Action: If you control 5 or more resources, deploy this leader."

function vaderBase() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.ibh.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
}

function leiaBase() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.ibh.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
}

describe("IBH_053 Darth Vader (leader) — Action: deal 1 to a base", () => {
  it("deals 1 to the chosen base and exhausts (paying 1 resource)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(vaderBase().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1); // 1 resource spent
  });

  it("Epic Action deploys with 6 resources but not 5", async () => {
    const g6 = new GameTestAdapter();
    g6.loadNewState(vaderBase().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6).Build());
    await g6.deployLeaderAsync(1);
    expect(g6.state.player1.leader.deployed).toBe(true);

    const g5 = new GameTestAdapter();
    g5.loadNewState(vaderBase().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5).Build());
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(false);
  });
});

describe("IBH_001 Leia Organa (leader) — Action: heal 1 from a friendly unit", () => {
  it("heals 1 from the chosen friendly unit and exhausts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      leiaBase()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // 2 damage
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(1); // healed 2 → 1
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("is unavailable with no friendly unit to heal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(leiaBase().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6).Build());
    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("Epic Action deploys with 5 resources but not 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(leiaBase().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5).Build());
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(true);

    const g4 = new GameTestAdapter();
    g4.loadNewState(leiaBase().FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4).Build());
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(false);
  });
});

// The deployed leader-unit keeps the same Action ability. The engine's use-ability dispatch can't
// re-trigger a leader once it's deployed, but the deployed-side registration is what makes the
// ability available on the unit — assert it via ActionAbilities with the deployed unit's playId.
describe("Deployed-side action registration", () => {
  it("deployed Darth Vader's unit still exposes its Action ability", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      vaderBase()
        .MyLeader(Cards.leaders.ibh.darthVader, true, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.ibh.darthVader)
        .Build(),
    );
    const playId = g.state.player1.groundArena[0].playId;
    expect(ActionAbilities(Cards.leaders.ibh.darthVader, 1, playId)).toContain(Cards.leaders.ibh.darthVader);
  });

  it("deployed Leia's unit exposes its Action ability while controlling a friendly unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      leiaBase()
        .MyLeader(Cards.leaders.ibh.leiaOrgana, true, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.ibh.leiaOrgana)
        .Build(),
    );
    const playId = g.state.player1.groundArena[0].playId;
    // Leia's Action needs a friendly unit to heal — the deployed Leia unit itself qualifies.
    expect(ActionAbilities(Cards.leaders.ibh.leiaOrgana, 1, playId)).toContain(Cards.leaders.ibh.leiaOrgana);
  });
});
