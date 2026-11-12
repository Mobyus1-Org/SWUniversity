import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// IC27_163 Bo-Katan Kryze — Right Place, Right Time (7/6 Ground, cost 7, Cunning/Heroism)
//   "Shielded. When Played: Give each enemy unit –7/–0 for this phase."

const BO = Cards.units.ic27.boKatanKryze;
const SNOKE = Cards.units.ic27.snoke;                  // 8/6 — drops to 1
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, BO)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(2, SNOKE)
    .WithSpaceUnitForPlayer(2, Cards.units.sor.allianceXWing);
}

/** Plays Bo-Katan and answers the Shielded / When Played ordering prompt, if one is raised. */
async function playBo(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  const res = g.lastDispatchResponse?.resolutionNeeded as { type?: string; options?: string[] } | undefined;
  if (res?.type === "Option" && res.options) await g.chooseOptionAsync(1, res.options[0]);
}

const power = (u: Parameters<typeof Unit.FromInterface>[0]) => Unit.FromInterface(u).CurrentPower();

describe("IC27_163 Bo-Katan Kryze", () => {
  it("Shielded: she enters with a Shield token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await playBo(g);

    const bo = g.state.player1.groundArena.find(u => u.cardId === BO)!;
    expect(bo.upgrades.map(u => u.cardId)).toEqual([Cards.upgrades.token.shield]);
  });

  it("When Played: each enemy unit, both arenas, gets –7/–0 — HP unchanged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await playBo(g);

    expect(power(g.state.player2.groundArena[0])).toBe(1);
    expect(Unit.FromInterface(g.state.player2.groundArena[0]).TotalHP()).toBe(6);
    expect(power(g.state.player2.spaceArena[0])).toBeLessThanOrEqual(0);
  });

  it("friendly units are untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await playBo(g);

    expect(power(g.state.player1.groundArena[0])).toBe(3);
    expect(power(g.state.player1.groundArena.find(u => u.cardId === BO)!)).toBe(7);
  });

  it("the debuff lasts into a later action this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await playBo(g);
    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetZones: ["Base"], targetPlayers: [1] });

    expect(g.state.player1.base.damage).toBe(1);
  });
});
