import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const AMBITION = Cards.upgrades.hmw.villainousAmbition;
const DEATH_TROOPERS = Cards.units.ash.deathTrooperSquad; // Villainy

// HMW_252 Villainous Ambition: "When Played: If attached unit is a Villainy unit, you may deal 2 damage to a unit."
describe("HMW_252 Villainous Ambition", () => {
  const setup = (host: string) => load(board(Cards.leaders.sor.darthVader).WithGroundUnitForPlayer(1, host).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, AMBITION).Build());
  const play = async (g: ReturnType<typeof setup>) => { await F.playFromHand(g); await F.pick(g, [g.state.player1.groundArena[0].playId]); };

  it("on a Villainy unit: 2 damage to a unit", async () => {
    const g = setup(DEATH_TROOPERS);
    await play(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("on a non-Villainy unit: nothing", async () => {
    const g = setup(MARINE);
    await play(g);
    expect(F.prompt(g)).toBeNull();
  });
});
