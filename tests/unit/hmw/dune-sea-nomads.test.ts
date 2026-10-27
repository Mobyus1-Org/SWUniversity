import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// HMW_167 Dune Sea Nomads (3/5 Ground, cost 4, Aggression/Heroism, Tusken) — "Raid 3".
const NOMADS = Cards.units.hmw.duneSeaNomads;

function setup(cardId: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, cardId)
    .WithActivePlayer(1)
    .Build();
}

describe("HMW_167 Dune Sea Nomads — Raid 3", () => {
  it("attacks the base for 6 (3 power + Raid 3)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(NOMADS));
    const nomads = g.state.player1.groundArena[0];
    expect(RaidAmount(NOMADS, nomads.playId, 1)).toBe(3);

    await g.attackWithGroundUnitAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("control: a vanilla 3-power unit attacks for 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.sor.battlefieldMarine));
    await g.attackWithGroundUnitAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(3);
  });
});
