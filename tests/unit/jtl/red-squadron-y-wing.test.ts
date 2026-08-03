import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// JTL_149 Red Squadron Y-Wing (1/3 Space, cost 2) —
//   "On Attack: Deal 3 indirect damage to the defending player.
//    (They assign 3 unpreventable damage among their base and units.)"
describe("JTL_149 Red Squadron Y-Wing", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.sabineWren) // Aggression/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithActivePlayer(1);
  }

  it("attacking a base: the defending player assigns 3 indirect damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.redSquadronYWing)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    // Player 2 assigns all 3 to their own base.
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [{ playId: "player2.base", damage: 3 }],
    });

    expect(g.state.player2.base.damage).toBe(4); // 1 combat + 3 indirect
  });

  it("the defender may split the indirect damage between units and base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.redSquadronYWing)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6/9
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const walkerId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [
        { playId: walkerId, damage: 2 },
        { playId: "player2.base", damage: 1 },
      ],
    });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(2); // 1 combat + 1 indirect
  });

  it("rejects an assignment that does not total exactly 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.redSquadronYWing)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [{ playId: "player2.base", damage: 2 }],
    });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("attacking a UNIT still sends the indirect damage to that unit's controller", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.redSquadronYWing)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.devastator) // 10/10 — survives
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [{ playId: "player2.base", damage: 3 }],
    });

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("control: a plain attacker deals no indirect damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(2); // combat only
  });
});
