import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

// SOR_043 — Superlaser Blast (cost 8, Vigilance+Villainy): "Defeat all units."
// TWI_078 — The Invasion of Christophsis (cost 15, Exploit 4, Vigilance): "Choose an opponent. Defeat each unit that player controls."
//
// Board-wipe rule: all When-Defeated and When-Enemy-Unit-Defeated abilities
// trigger simultaneously — every unit that dies in the same wipe adds its
// triggers to the bag before any of them resolve.

// Iden Versio leader covers Vigilance+Villainy — no aspect penalty for either card.
function idenBase(p1BaseDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, p1BaseDamage)
    .MyLeader(Cards.leaders.sor.idenVersio)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
}

// ─── SOR_043 Superlaser Blast ──────────────────────────────────────────────

describe("SOR_043 — Superlaser Blast: Defeat all units", () => {
  it("defeats all units in both arenas", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      idenBase()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.sor.superlaserBlast)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("defeats units in both ground and space arenas", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      idenBase()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.sor.superlaserBlast)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    await g.playCardFromHandAsync(1, 0);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.spaceArena).toHaveLength(0);
  });

  it("Iden unit heals 1 damage per enemy unit defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      idenBase(10)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.sor.superlaserBlast)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.idenVersio) // Iden unit in arena
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    await g.playCardFromHandAsync(1, 0);
    // 3 enemy units defeated → Iden heals 3
    expect(g.state.player1.base.damage).toBe(7);
    expect(g.state.player1.groundArena).toHaveLength(0); // Iden also defeated by SLB
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("each Iden unit heals for their own enemies when both players have Iden deployed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 10)
        .MyLeader(Cards.leaders.sor.idenVersio)
        .TheirBase(Cards.bases.common.green30HP, 6)
        .TheirLeader(Cards.leaders.sor.idenVersio)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.sor.superlaserBlast)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.idenVersio) // P1 Iden unit
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.idenVersio) // P2 Iden unit
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    await g.playCardFromHandAsync(1, 0);
    // P1 Iden fires for P2's 3 units → heals 3 → 10-3=7
    expect(g.state.player1.base.damage).toBe(7);
    // P2 Iden fires for P1's 2 units → heals 2 → 6-2=4
    expect(g.state.player2.base.damage).toBe(4);
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("Gideon can give XP to a captured unit that is rescued when its captor is board-wiped", async () => {
    // When P2's captor unit dies in SLB, the captured P1 marine is rescued and enters P1's arena.
    // Gideon fires once per P2 unit (2 total). By the time the triggers resolve, Gideon is dead
    // but the rescued marine is in P1's arena — it is the only valid XP target.
    const g = new GameTestAdapter();
    const state = idenBase()
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithCardInHandForPlayer(1, Cards.events.sor.superlaserBlast)
      .WithGroundUnitForPlayer(1, Cards.units.sor.gideonHask)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // will become P2's captive
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // captor
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // second P2 unit
      .Build();

    // Move P1's marine from the arena into P2's first unit's captives
    const captive = state.player1.groundArena.splice(1, 1)[0];
    state.player2.groundArena[0].captives = [captive];

    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // play SLB
    // Gideon fires 2× (for P2's 2 units). Rescued marine is the only P1 unit in play.
    const rescuedMarinePlayId = captive.playId;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [rescuedMarinePlayId] }); // XP #1
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [rescuedMarinePlayId] }); // XP #2

    const rescuedMarine = g.state.player1.groundArena.find(u => u.playId === rescuedMarinePlayId);
    expect(rescuedMarine).toBeDefined();
    expect(rescuedMarine!.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience)).toHaveLength(2);
  });

  it("Gideon Hask soft-passes when all friendly units are also defeated by the board wipe", async () => {
    // SLB kills ALL units — by the time Gideon's trigger resolves, there are no
    // P1 friendly units left to receive XP, so Gideon soft-passes with no effect.
    const g = new GameTestAdapter();
    g.loadNewState(
      idenBase()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.sor.superlaserBlast)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gideonHask)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    await g.playCardFromHandAsync(1, 0); // play SLB — Gideon soft-passes, no choose-target needed
    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.discard.filter(c => c.cardId === Cards.units.sor.gideonHask)).toHaveLength(1);
  });
});

// ─── TWI_078 Invasion of Christophsis ─────────────────────────────────────

describe("TWI_078 — The Invasion of Christophsis: Exploit 4. Choose an opponent. Defeat each unit that player controls.", () => {
  it("defeats only the opponent's units — controller's units survive", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      idenBase()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 15)
        .WithCardInHandForPlayer(1, Cards.events.twi.christophsis)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // decline Exploit 4
    expect(g.state.player1.groundArena).toHaveLength(1); // P1 unit survives
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("Iden unit heals per enemy defeated and survives the wipe", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      idenBase(10)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 15)
        .WithCardInHandForPlayer(1, Cards.events.twi.christophsis)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.idenVersio) // Iden unit survives
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // decline Exploit
    // 3 enemy units defeated → Iden heals 3
    expect(g.state.player1.base.damage).toBe(7);
    expect(g.state.player1.groundArena).toHaveLength(1); // Iden is still alive
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("each Iden unit heals for their own enemies; P2 Iden fires for zero P1 units (none defeated)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 10)
        .MyLeader(Cards.leaders.sor.idenVersio)
        .TheirBase(Cards.bases.common.green30HP, 6)
        .TheirLeader(Cards.leaders.sor.idenVersio)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 15)
        .WithCardInHandForPlayer(1, Cards.events.twi.christophsis)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.idenVersio) // P1 Iden survives
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // P1 marine survives
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.idenVersio) // P2 Iden is defeated
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // decline Exploit
    // P1 Iden fires for P2's 3 units → heals 3 → 10-3=7
    expect(g.state.player1.base.damage).toBe(7);
    // P2 Iden fires for 0 P1 units (P1 had no units defeated) → P2 base unchanged
    expect(g.state.player2.base.damage).toBe(6);
    expect(g.state.player1.groundArena).toHaveLength(2); // Iden + marine survive
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("Gideon Hask fires once per enemy defeated and survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      idenBase()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 15)
        .WithCardInHandForPlayer(1, Cards.events.twi.christophsis)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gideonHask)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // XP target
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    const marinePlayId = g.state.player1.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // decline Exploit
    // 2 enemy marines die → Gideon fires twice
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] }); // XP #1
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] }); // XP #2

    const marine = g.state.player1.groundArena.find(u => u.playId === marinePlayId);
    expect(marine?.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience)).toHaveLength(2);
    // Gideon and marine survive
    expect(g.state.player1.groundArena).toHaveLength(2);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("Exploit 4 can sacrifice a friendly unit to reduce the cost", async () => {
    // Sacrifice 1 unit: cost drops from 15 → 13. P1 needs 13 resources.
    const g = new GameTestAdapter();
    g.loadNewState(
      idenBase()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 13)
        .WithCardInHandForPlayer(1, Cards.events.twi.christophsis)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // sacrificed as Exploit cost
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build()
    );
    const p1MarinePlayId = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // accept Exploit
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [p1MarinePlayId] }); // sacrifice P1 marine

    expect(g.state.player1.groundArena).toHaveLength(0); // P1 marine was exploited
    expect(g.state.player2.groundArena).toHaveLength(0); // P2 marine defeated
  });
});
