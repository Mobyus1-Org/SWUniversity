import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_097 Eeth Koth (Spiritual Warrior) — unique 5/4 Ground, cost 4
// "When Defeated: You may use the Force. If you do, put this card into play as a resource."

function baseState(withForce: boolean) {
  const state = new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    // 3 damage already on Eeth Koth (4 HP) so a 3-power attacker defeats it.
    .WithGroundUnitForPlayer(1, Cards.units.lof.eethKoth, true, 3)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
    .WithActivePlayer(2)
    .Build();
  state.player1.supplemental.forceToken = withForce;
  return state;
}

async function defeatEethKoth(g: GameTestAdapter) {
  const kothPlayId = g.state.player1.groundArena[0].playId;
  await g.attackWithGroundUnitAsync(2, 0);
  await g.dispatchAsync(2, "choose-target", { targetPlayIds: [kothPlayId] });
}

describe("LOF_097 Eeth Koth", () => {
  it("offers the optional Force prompt when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState(true));

    await defeatEethKoth(g);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("Yes spends the Force and puts the card into play as a resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState(true));

    await defeatEethKoth(g);
    await g.chooseYesAsync(1);

    const resource = g.state.player1.resources.find(r => r.cardId === Cards.units.lof.eethKoth);
    expect(resource).toBeDefined();
    expect(g.state.player1.supplemental.forceToken).toBe(false);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.lof.eethKoth)).toBe(false);
  });

  it("the resource enters exhausted (no 'and ready it' clause)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState(true));

    await defeatEethKoth(g);
    await g.chooseYesAsync(1);

    const resource = g.state.player1.resources.find(r => r.cardId === Cards.units.lof.eethKoth);
    expect(resource?.ready).toBe(false);
  });

  it("No leaves the card in the discard and keeps the Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState(true));

    await defeatEethKoth(g);
    await g.chooseNoAsync(1);

    expect(g.state.player1.resources.some(r => r.cardId === Cards.units.lof.eethKoth)).toBe(false);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.lof.eethKoth)).toBe(true);
    expect(g.state.player1.supplemental.forceToken).toBe(true);
  });

  it("does not prompt at all without a Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState(false));

    await defeatEethKoth(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.resources.some(r => r.cardId === Cards.units.lof.eethKoth)).toBe(false);
    expect(g.state.player1.discard.some(d => d.cardId === Cards.units.lof.eethKoth)).toBe(true);
  });
});
