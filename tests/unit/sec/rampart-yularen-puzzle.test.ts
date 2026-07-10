import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Repro for QA: "The Empire Requires Precision" (Yularen) breaks after disclosing for
// Rampart's ability. P1 uses Yularen's leader Action to attack with Vice Admiral Rampart,
// then discloses CommandCommandVillainy to give Experience to up to 2 units. The bug: after
// giving XP, the pending combat resolution (resolve-attack) was rendered as a bare
// {type:"Target"} prompt instead of being executed — so combat never happened and the UI
// showed an unresolvable prompt.
describe("SEC_085 Rampart via SEC_006 Yularen leader action", () => {
  it("resolves disclose + XP, deals combat damage, then offers Yularen's second attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sec.colonelYularen)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sec.viceAdmiralRampart) // cost 6, power 3
        .WithGroundUnitForPlayer(1, Cards.units.lof.vanee)              // cheaper — Yularen's 2nd attack
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // defender (3 HP)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.jtl.unityOfPurpose)    // Command,Command
        .WithCardInHandForPlayer(1, Cards.units.sec.isbShuttle)         // Command,Villainy
        .Build(),
    );

    const rampartId = g.state.player1.groundArena[0].playId;
    const vaneeId = g.state.player1.groundArena[1].playId;
    const enemy0 = g.state.player2.groundArena[0].playId;
    const enemy1 = g.state.player2.groundArena[1].playId;

    await g.useLeaderAbilityAsync(1);
    // Choose Rampart as the attacker.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [rampartId] });
    // Rampart attacks the first Battlefield Marine.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy0] });
    // Disclose (yes), then give XP to Vanee and the OTHER marine (not the defender).
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [vaneeId, enemy1] });

    // Both chosen units got Experience tokens.
    const vanee = g.state.player1.groundArena.find(u => u.playId === vaneeId);
    const otherMarine = g.state.player2.groundArena.find(u => u.playId === enemy1);
    expect(vanee?.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
    expect(otherMarine?.upgrades.some(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);

    // Combat actually resolved: the attacked marine (3 HP) took Rampart's 3 power and was defeated.
    expect(g.state.player2.groundArena.some(u => u.playId === enemy0)).toBe(false);

    // Yularen's follow-up prompt is a well-formed Option (not a bare/empty Target).
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");
  });
});
