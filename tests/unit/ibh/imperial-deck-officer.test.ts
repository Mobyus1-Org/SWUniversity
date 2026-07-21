import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_062 Imperial Deck Officer (1/4 Ground, cost 2, Imperial, Vigilance)
// "Action [Exhaust]: Heal 2 damage from a Villainy unit."

function setup(officerId = Cards.units.ibh.imperialDeckOfficer, withVillainyUnit = true) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, officerId);
  if (withVillainyUnit) {
    // Blizzard Force AT-ST is a Villainy unit; pre-damage it by 3 to observe the heal.
    b = b.WithGroundUnitForPlayer(1, Cards.units.ibh.blizzardForceAtst, true, 3);
  }
  return b;
}

describe("IBH_062 Imperial Deck Officer — Action: Heal 2 from a Villainy unit", () => {
  it("heals 2 damage from the chosen Villainy unit and exhausts", async () => {
    const g = new GameTestAdapter();
    const s = setup().Build();
    g.loadNewState(s);
    const officerPlayId = s.player1.groundArena[0].playId;
    const villainPlayId = s.player1.groundArena[1].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ibh.imperialDeckOfficer, playId: officerPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainPlayId] });

    expect(g.state.player1.groundArena.find(u => u.playId === villainPlayId)!.damage).toBe(1); // 3 - 2
    expect(g.state.player1.groundArena.find(u => u.playId === officerPlayId)!.ready).toBe(false);
  });

  it("control: no Villainy unit → ability not available (no-op)", async () => {
    const g = new GameTestAdapter();
    const s = setup(Cards.units.ibh.imperialDeckOfficer, false).Build();
    g.loadNewState(s);
    const officerPlayId = s.player1.groundArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ibh.imperialDeckOfficer, playId: officerPlayId });

    // Deck Officer is Vigilance (not Villainy) — no legal target, stays ready.
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("alt printing IBH_100 also heals a Villainy unit", async () => {
    const g = new GameTestAdapter();
    const s = setup(Cards.units.ibh.imperialDeckOfficerB).Build();
    g.loadNewState(s);
    const officerPlayId = s.player1.groundArena[0].playId;
    const villainPlayId = s.player1.groundArena[1].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ibh.imperialDeckOfficerB, playId: officerPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [villainPlayId] });

    expect(g.state.player1.groundArena.find(u => u.playId === villainPlayId)!.damage).toBe(1);
  });
});
