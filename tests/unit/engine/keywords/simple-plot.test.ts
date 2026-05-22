import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

// Qi'ra (SHD_002): 8 HP, Grit, Aspects [Villainy, Vigilance], When Deployed: heal all then deal floor(HP/2)
// Cad Bane (SEC_034): 5 HP, cost 4, Aspects [Vigilance, Villainy], Plot
//   When Played: You may defeat a unit with 2 or less remaining HP.
// Aspect penalty = 0 (Qi'ra as leader covers both Vigilance + Villainy).

function qiraPlotSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.shd.qira)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .FillResourcesForPlayer(1, Cards.units.sec.cadBane, 1); // index 10
}

describe("Plot mechanic — Qi'ra (SHD_002) + Cad Bane (SEC_034)", () => {
  it("When Deployed First: enemy (4HP) takes floor(4/2)=2 damage, then Cad Bane defeats it", async () => {
    // SOR_097 Admiral Ackbar: 4HP ground unit
    // When Deployed deals floor(4/2)=2 → 2 remaining HP → Cad Bane can defeat
    const g = new GameTestAdapter();
    g.loadNewState(
      qiraPlotSetup()
        .WithGroundUnitForPlayer(2, "SOR_097")
        .Build(),
    );

    await g.deployLeaderAsync(1);
    await g.chooseOptionAsync(1, "When Deployed First");
    // Qi'ra (8HP) → 4 damage; Admiral Ackbar (4HP) → 2 damage (2 remaining HP)
    await g.choosePlotCardAsync(1, 10);
    // Cad Bane enters play; targets Admiral Ackbar (2 remaining HP ≤ 2)
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena).toHaveLength(2); // Qi'ra + Cad Bane
    expect(g.state.player1.groundArena[0].damage).toBe(4); // Qi'ra: floor(8/2)=4
    expect(g.state.player1.groundArena[1].cardId).toBe(Cards.units.sec.cadBane);
    expect(g.state.player1.groundArena[1].damage).toBe(0); // Cad Bane entered after When Deployed
  });

  it("When Deployed First: enemy (3HP) takes floor(3/2)=1 damage, then Cad Bane defeats it", async () => {
    // Battlefield Marine: 3HP → When Deployed deals floor(3/2)=1 → 2 remaining HP → Cad Bane can defeat
    const g = new GameTestAdapter();
    g.loadNewState(
      qiraPlotSetup()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.deployLeaderAsync(1);
    await g.chooseOptionAsync(1, "When Deployed First");
    // Marine (3HP) → 1 damage (2 remaining HP); Qi'ra (8HP) → 4 damage
    await g.choosePlotCardAsync(1, 10);
    // Cad Bane targets marine (2 remaining HP ≤ 2)
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(4); // Qi'ra: floor(8/2)=4
    expect(g.state.player1.groundArena[1].cardId).toBe(Cards.units.sec.cadBane);
    expect(g.state.player1.groundArena[1].damage).toBe(0);
  });

  it("Plot First: Cad Bane defeats pre-damaged enemy (6HP, 4 dmg), then When Deployed hits remaining units", async () => {
    // Bright Hope (SOR_099): 6HP space unit, starts with 4 damage → 2 remaining HP
    // Plot First: Cad Bane defeats Bright Hope → WhenDeployedPending fires automatically
    // When Deployed: heal all → deal floor(HP/2): Qi'ra (8HP)→4, Cad Bane (5HP)→2
    const g = new GameTestAdapter();
    g.loadNewState(
      qiraPlotSetup()
        .WithSpaceUnitForPlayer(2, Cards.units.sor.brightHope, true, 4)
        .Build(),
    );

    await g.deployLeaderAsync(1);
    await g.chooseOptionAsync(1, "Plot First");
    await g.choosePlotCardAsync(1, 10);
    // Bright Hope has 2 remaining HP → eligible; defeating it triggers WhenDeployedPending continuation
    await g.chooseSpaceUnitAsync(2, 0);
    // When Deployed fires automatically: heals all, then deals floor(HP/2)

    expect(g.state.player2.spaceArena).toHaveLength(0); // Bright Hope defeated
    expect(g.state.player1.groundArena).toHaveLength(2); // Qi'ra + Cad Bane
    expect(g.state.player1.groundArena[0].damage).toBe(4); // Qi'ra: floor(8/2)=4
    expect(g.state.player1.groundArena[1].cardId).toBe(Cards.units.sec.cadBane);
    expect(g.state.player1.groundArena[1].damage).toBe(2); // Cad Bane: floor(5/2)=2
  });

  it("CR 19d: replacement Plot card from deck cannot be played in the same deploy action", async () => {
    // Setup: 1 Cad Bane in resources (affordable), top of deck is another Cad Bane (Plot card).
    // After playing the resource Cad Bane via Plot, the deck Cad Bane replaces it (exhausted).
    // The Plot window must NOT reopen — the replacement card is ineligible per CR 19d.
    // No enemy units → SEC_034 When Played auto-resolves (no eligible targets).
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.qira)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
        .FillResourcesForPlayer(1, Cards.units.sec.cadBane, 1) // resource index 10
        .WithCardInDeckForPlayer(1, Cards.units.sec.cadBane)   // deck top → replacement
        .Build(),
    );

    await g.deployLeaderAsync(1);
    // PlotOrderPending: Qi'ra has When Deployed + Plot card
    await g.chooseOptionAsync(1, "Plot First");
    // PlotWindowPending: only the original resource Cad Bane is eligible
    await g.choosePlotCardAsync(1, 10);
    // Cad Bane plays: SEC_034 When Played auto-resolves (no units ≤2 HP).
    // Deck Cad Bane enters resources as exhausted replacement.
    // Plot window must NOT reopen → When Deployed fires automatically.

    // Game should be fully resolved: no pending resolution, Qi'ra took WD self-damage.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    // Qi'ra is in ground arena (deployed), Cad Bane is also there (played via Plot).
    expect(g.state.player1.groundArena).toHaveLength(2);
    expect(g.state.player1.groundArena[1].cardId).toBe(Cards.units.sec.cadBane);
    // When Deployed fired: Qi'ra (8HP) → floor(8/2)=4, Cad Bane (5HP) → floor(5/2)=2
    expect(g.state.player1.groundArena[0].damage).toBe(4); // Qi'ra
    expect(g.state.player1.groundArena[1].damage).toBe(2); // Cad Bane
    // Replacement deck card is in resources as exhausted (not played)
    const replacement = g.state.player1.resources.find(r => r.cardId === Cards.units.sec.cadBane);
    expect(replacement).toBeDefined();
    expect(replacement?.ready).toBe(false); // exhausted, was not played
  });
});
