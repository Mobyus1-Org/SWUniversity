import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_220 Shien Flurry (Event) — "Play a Force unit from your hand (paying its cost). It gains
// Ambush for this phase. The next time it would be dealt damage this phase, prevent 2 of that damage."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.lof.shienFlurry);
}

function preventEffects(g: GameTestAdapter) {
  return g.state.currentEffects.filter(e => e.cardId === "LOF_220_prevent");
}

describe("LOF_220 Shien Flurry", () => {
  it("plays a Force unit from hand which gains Ambush and can attack immediately", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.lof.gungi) // a 2/5 Force unit
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);   // Shien Flurry
    await g.chooseCardFromHandAsync(1, 0); // choose Gungi to play
    await g.chooseYesAsync(1);             // use the granted Ambush
    await g.chooseGroundUnitAsync(2, 0);   // attack the enemy Marine

    // Gungi is in play and dealt its 2 combat damage.
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.lof.gungi)).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("rejects a non-Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Force unit
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const res = await g.chooseCardFromHandAsync(1, 0);

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("prevents 2 of the next damage — combat counter-damage, before the played unit's own Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.lof.gungi)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 — deals 3 counter-damage
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    const gungi = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.gungi)!;
    expect(gungi.damage).toBe(1);            // 3 counter-damage – 2 prevented
    expect(preventEffects(g)).toHaveLength(0); // one-shot: consumed
  });

  it("prevents 2 of the next ability damage (DealDamageToUnit path)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.lof.gungi)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 4)
        .WithCardInHandForPlayer(2, Cards.events.shd.daringRaid) // opponent's 2-damage event
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // decline Ambush; the turn passes to player 2

    const gungiPlayId = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.gungi)!.playId;
    await g.playCardFromHandAsync(2, 0); // Daring Raid
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [gungiPlayId] });

    const gungi = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.gungi)!;
    expect(gungi.damage).toBe(0);            // 2 damage fully prevented
    expect(preventEffects(g)).toHaveLength(0);
  });
});
