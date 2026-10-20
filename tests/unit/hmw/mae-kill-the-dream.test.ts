import { describe, it, expect } from "vitest";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import { HasGrit } from "@/server/engine/card-db/keyword-dictionaries.ts/grit";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_055 Mae — Kill the Dream (Unit, cost 3, 2/4 Ground, Cunning/Vigilance/Villainy, Force/Sith)
//   Ambush
//   Shielded
//   Grit
//
// Her whole card is three keywords, so implementing her means registering all three. Each is
// asserted twice: once through its dictionary, and once through the behaviour it buys, because a
// dictionary entry nothing reads would still pass the first check.
const MAE = Cards.units.hmw.mae;
const ENEMY = Cards.units.sor.battlefieldMarine; // 3/3

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP) // Cunning
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, ENEMY, 20);
}

const promptOptions = (g: GameTestAdapter): string[] | undefined => {
  const r = g.lastDispatchResponse?.resolutionNeeded;
  return r && "options" in r ? (r.options as string[]) : undefined;
};

describe("HMW_055 Mae — Kill the Dream", () => {
  it("has Ambush, Shielded and Grit registered", () => {
    expect(HasAmbush(MAE)).toBe(true);
    expect(HasShielded(MAE)).toBe(true);
    expect(HasGrit(MAE)).toBe(true);
  });

  it("Shielded: entering play gives her a Shield token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, MAE).Build());

    await g.playCardFromHandAsync(1, 0);

    // Shielded and Ambush trigger together, so she is ordered first even with no enemy to hit.
    expect(promptOptions(g)).toEqual(["Mae — Shielded", "Mae — Ambush"]);
    await g.chooseOptionAsync(1, "Mae — Shielded");

    const mae = g.state.player1.groundArena.find(u => u.cardId === MAE)!;
    expect(mae.upgrades.some(u => u.cardId === Cards.upgrades.token.shield)).toBe(true);
  });

  it("Ambush: she may attack an enemy unit as she enters", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(1, MAE).WithGroundUnitForPlayer(2, ENEMY).Build());

    await g.playCardFromHandAsync(1, 0);
    // Resolve Shielded first so the Shield is on her before the counter-attack lands.
    expect(promptOptions(g)).toEqual(["Mae — Shielded", "Mae — Ambush"]);
    await g.chooseOptionAsync(1, "Mae — Shielded");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    // 2 power into a 3/3 Marine; the Marine's 3 back is soaked by her Shield token.
    expect(g.state.player2.groundArena[0].damage).toBe(2);
    const mae = g.state.player1.groundArena.find(u => u.cardId === MAE)!;
    expect(mae.upgrades.some(u => u.cardId === Cards.upgrades.token.shield)).toBe(false); // spent
    expect(mae.damage).toBe(0);
  });

  it("Grit: she gets +1/+0 for each damage on her", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MAE, true, 3).Build()); // 3 damage on her

    const mae = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(mae.CurrentPower()).toBe(5); // printed 2 + 3 damage
  });

  it("Grit: an undamaged Mae is just her printed power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MAE).Build());

    const mae = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(mae.CurrentPower()).toBe(2);
  });
});
