import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_081 Mace Windu — Dropping By (5/5 Ground, cost 6, Command/Heroism)
//   "Ambush. On Attack: Give an Experience token to this unit."

const MACE = Cards.units.ic27.maceWindu;
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7 Ground, no text
const XP = Cards.upgrades.token.experience;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20);
}

const xpOn = (g: GameTestAdapter) => g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === XP).length;

describe("IC27_081 Mace Windu — Dropping By", () => {
  it("On Attack gives him an Experience token before damage: he hits the base for 6", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MACE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(xpOn(g)).toBe(1);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("each attack adds another token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MACE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    g.state.player1.groundArena[0].ready = true;
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(xpOn(g)).toBe(2);
    expect(g.state.player2.base.damage).toBe(6 + 7);
  });

  it("has Ambush: played from hand he may attack an enemy unit, and gets his token doing it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, MACE).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(xpOn(g)).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(6);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("control: no token without attacking", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MACE).Build());

    expect(xpOn(g)).toBe(0);
  });
});
