import { describe, expect, it } from "vitest";
import { SmuggleCost, SmuggleAspects } from "@/server/engine/card-db/keyword-dictionaries.ts/smuggle";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { effectiveSmuggleCost, ResourceIsSmuggleable } from "@/server/engine/card-playability";
import { Cards } from "../../../card-helpers";
import { GameTestAdapter } from "../../game-test-adapter";
import type { Resource } from "@/lib/engine/core-models";

function makeResource(cardId: string, ready = true): Resource {
  return { cardId, playId: "r1", owner: 1, controller: 1, ready, stolen: false };
}

describe("SmuggleCost", () => {
  it("returns the Smuggle dict cost for SHD_086", () => {
    expect(SmuggleCost("SHD_086")).toBe(4);
  });
  it("returns -1 for a card with no Smuggle", () => {
    expect(SmuggleCost("SOR_095")).toBe(-1); // Battlefield Marine has no Smuggle
  });
});

describe("SmuggleAspects", () => {
  it("SHD_086 Warbird Stowaway bracket is [Command, Villainy]", () => {
    expect(SmuggleAspects("SHD_086")).toEqual(["Command", "Villainy"]);
  });
  it("SHD_050 Chewbacca bracket [Aggression, Heroism] differs from card aspects [Heroism, Vigilance]", () => {
    expect(SmuggleAspects("SHD_050")).toEqual(["Aggression", "Heroism"]);
  });
  it("SHD_052 Sugi bracket [Vigilance] differs from card aspects [Vigilance, Vigilance]", () => {
    expect(SmuggleAspects("SHD_052")).toEqual(["Vigilance"]);
  });
  it("SHD_213 DJ bracket [Cunning, Cunning] differs from card aspects [Cunning]", () => {
    expect(SmuggleAspects("SHD_213")).toEqual(["Cunning", "Cunning"]);
  });
  it("SHD_217 Tobias bracket [Vigilance] differs from card aspects [Cunning]", () => {
    expect(SmuggleAspects("SHD_217")).toEqual(["Vigilance"]);
  });
  it("SHD_248 Tech bracket [Heroism] matches card aspects", () => {
    expect(SmuggleAspects("SHD_248")).toEqual(["Heroism"]);
  });
  it("returns [] for a card with no Smuggle", () => {
    expect(SmuggleAspects("SOR_095")).toEqual([]);
  });
});

describe("effectiveSmuggleCost — own Smuggle path", () => {
  it("SHD_086: costs 4 when player has Command + Villainy (no aspect penalty)", () => {
    // Vader (Aggression+Villainy) + green30HP (Command)
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .Build();
    const cost = effectiveSmuggleCost(state, 1, makeResource("SHD_086"));
    expect(cost).toBe(4);
  });

  it("SHD_086: costs 8 when player has neither Command nor Villainy (+4 penalty)", () => {
    // Chewbacca leader (Vigilance+Heroism) + blue30HP (Vigilance) — no Command, no Villainy
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .Build();
    const cost = effectiveSmuggleCost(state, 1, makeResource("SHD_086"));
    expect(cost).toBe(8); // 4 + 2 (missing Command) + 2 (missing Villainy)
  });

  it("returns null for a card with no Smuggle", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .Build();
    // SOR_095 (Battlefield Marine) has no Smuggle, Tech not in play
    const cost = effectiveSmuggleCost(state, 1, makeResource("SOR_095"));
    expect(cost).toBeNull();
  });
});

describe("effectiveSmuggleCost — Tech passive path", () => {
  it("Tech in play gives Smuggle to a resource that has none (printed cost + 2)", () => {
    // SOR_066 (System Patrol Craft): CardCost=4, aspects=[Vigilance]. Tech: 4+2=6, Vigilance provided (no penalty).
    // Vader (Aggression+Villainy) + blue30HP (Vigilance): provided=[Aggression,Villainy,Vigilance]
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .WithGroundUnitForPlayer(1, "SHD_248") // Tech in play
      .Build();
    const cost = effectiveSmuggleCost(state, 1, makeResource("SOR_066"));
    expect(cost).toBe(6);
  });

  it("Tech in play picks minimum of own Smuggle and Tech path", () => {
    // SHD_086: own Smuggle = 4 (no penalty, has Command+Villainy from Vader+green)
    //          Tech path = CardCost(SHD_086)+2 = 3+2=5 (CardAspects=[Command,Villainy], no penalty)
    // Min = 4 (own Smuggle wins)
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)      // Command
      .MyLeader(Cards.leaders.sor.darthVader)    // Aggression + Villainy
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .WithGroundUnitForPlayer(1, "SHD_248")     // Tech in play
      .Build();
    const cost = effectiveSmuggleCost(state, 1, makeResource("SHD_086"));
    expect(cost).toBe(4); // own Smuggle wins
  });
});

describe("effectiveSmuggleCost — Tech passive scenarios from spec", () => {
  it("Chewbacca: own Smuggle wins when player has Aggression+Heroism (Smuggle bracket aspects)", () => {
    // Sabine (Aggression+Heroism) + blue30HP (Vigilance) = Aggression+Heroism+Vigilance
    // Own Smuggle [Aggression,Heroism]: both provided → 9+0=9
    // Tech [Heroism,Vigilance] (CardAspects): both provided → 8+2+0=10
    // Min = 9 (own Smuggle wins)
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_050"))).toBe(9);
  });

  it("Chewbacca: Tech wins when player has Heroism+Vigilance but not Aggression", () => {
    // Chewbacca leader (Vigilance+Heroism) + blue30HP (Vigilance) = 2×Vigilance+Heroism
    // Own Smuggle [Aggression,Heroism]: missing Aggression → 9+2=11
    // Tech [Heroism,Vigilance]: both provided → 8+2+0=10
    // Min = 10 (Tech wins)
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_050"))).toBe(10);
  });

  it("Sugi: own Smuggle wins when player has 1 Vigilance (bracket needs 1, card needs 2)", () => {
    // Vader (Aggression+Villainy) + blue30HP (Vigilance) = 1 Vigilance
    // Own Smuggle [Vigilance]: 1 needed, have 1 → 6+0=6
    // Tech [Vigilance,Vigilance]: need 2, have 1 → 4+2+2=8
    // Min = 6 (own Smuggle wins)
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_052"))).toBe(6);
  });

  it("Sugi: same cost with double Vigilance (6 either way)", () => {
    // Chewbacca leader (Vigilance+Heroism) + blue30HP (Vigilance) = 2×Vigilance
    // Own Smuggle: 6+0=6; Tech: 4+2+0=6. Same → 6
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_052"))).toBe(6);
  });

  it("DJ: Tech always wins even with double Cunning (7 vs 5)", () => {
    // Cad Bane (Cunning+Villainy) + yellow30HP (Cunning) = 2×Cunning+Villainy
    // Own Smuggle [Cunning,Cunning]: both covered → 7+0=7
    // Tech [Cunning]: covered → 3+2+0=5
    // Min = 5 (Tech wins)
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_213"))).toBe(5);
  });

  it("Tobias Beckett: own Smuggle wins when player has Vigilance (bracket) + Cunning (Tech)", () => {
    // Chewbacca leader (Vigilance+Heroism) + yellow30HP (Cunning) = Vigilance+Heroism+Cunning
    // Own Smuggle [Vigilance]: covered → 5+0=5
    // Tech [Cunning]: covered → 4+2+0=6
    // Min = 5 (own Smuggle wins)
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_217"))).toBe(5);
  });

  it("Tobias Beckett: Tech wins when player has Cunning but not Vigilance", () => {
    // Cad Bane (Cunning+Villainy) + yellow30HP (Cunning) = 2×Cunning+Villainy, no Vigilance
    // Own Smuggle [Vigilance]: missing → 5+2=7
    // Tech [Cunning]: covered → 4+2+0=6
    // Min = 6 (Tech wins)
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_217"))).toBe(6);
  });

  it("Hotshot Blaster: same cost with Aggression+Cunning (own=3, Tech=3)", () => {
    // Sabine (Aggression+Heroism) + yellow30HP (Cunning) = Aggression+Heroism+Cunning
    // Own Smuggle [Cunning]: covered → 3+0=3; Tech [Aggression]: covered → 1+2+0=3. Same → 3
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_174"))).toBe(3);
  });

  it("Hotshot Blaster: Tech wins when player has Aggression but not Cunning", () => {
    // Vader (Aggression+Villainy) + red30HP (Aggression) = 2×Aggression+Villainy, no Cunning
    // Own Smuggle [Cunning]: missing → 3+2=5; Tech [Aggression]: covered → 1+2+0=3. Tech wins.
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_174"))).toBe(3);
  });

  it("Lando's Pride: own Smuggle always wins over Tech (6 vs 8)", () => {
    // SHD_204 (Lando's Pride): SmuggleCost=6, SmuggleAspects=[Cunning,Heroism], CardCost=6, CardAspects=[Cunning,Heroism]
    // Chewie (Vigilance+Heroism) + yellow30HP (Cunning): provided=[Vigilance,Heroism,Cunning]
    // Own Smuggle [Cunning,Heroism]: both covered → 6+0=6
    // Tech [Cunning,Heroism]: both covered → 6+2+0=8
    // Min = 6 (own Smuggle wins)
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_204"))).toBe(6);
  });

  it("Tech-on-Tech: own Smuggle wins (4 < 3+2=5)", () => {
    // Leia (Command+Heroism) + green30HP (Command) = 2×Command+Heroism
    // Own [Heroism]: 4+0=4. Tech [Heroism]: 3+2+0=5. Own wins.
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, "SHD_248")
      .Build();
    expect(effectiveSmuggleCost(state, 1, makeResource("SHD_248"))).toBe(4);
  });
});

describe("ResourceIsSmuggleable", () => {
  it("returns true when resource is smuggleable and affordable", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, "SHD_086", 1)    // the smuggle card (ready)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 4) // 4 more ready
      .Build();
    // Cost=4, readyCount=5 (including SHD_086) >= 4 ✓
    expect(ResourceIsSmuggleable(state, 1, state.player1.resources[0])).toBe(true);
  });

  it("returns false when not enough ready resources", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, "SHD_086", 1)    // ready (contributes 1)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 2) // 2 more = 3 total ready < 4
      .Build();
    expect(ResourceIsSmuggleable(state, 1, state.player1.resources[0])).toBe(false);
  });

  it("returns false for a card with no Smuggle (no Tech)", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, "SOR_095", 5)    // Battlefield Marine, no Smuggle
      .Build();
    expect(ResourceIsSmuggleable(state, 1, state.player1.resources[0])).toBe(false);
  });
});

describe("Smuggle — basic play from resource zone", () => {
  it("plays a unit from resources: removes resource, enters arena exhausted", async () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, "SHD_086", 1)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 4)
      .WithCardInDeckForPlayer(1, Cards.bases.common.red30HP)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.groundArena).toHaveLength(1);
    expect(adapter.state.player1.groundArena[0].cardId).toBe("SHD_086");
    expect(adapter.state.player1.groundArena[0].ready).toBe(false);

    expect(adapter.state.player1.resources).toHaveLength(5);
    const readyResources = adapter.state.player1.resources.filter(r => r.ready);
    expect(readyResources).toHaveLength(1);
  });

  it("deck replacement enters resources exhausted", async () => {
    const deckCard = Cards.bases.common.red30HP;
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, "SHD_086", 1)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 4)
      .WithCardInDeckForPlayer(1, deckCard)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    const newResource = adapter.state.player1.resources.find(r => r.cardId === deckCard);
    expect(newResource).toBeDefined();
    expect(newResource!.ready).toBe(false);
  });

  it("empty deck: no replacement, no penalty damage to base", async () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, "SHD_086", 1)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 4)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.resources).toHaveLength(4);
    expect(adapter.state.player1.groundArena).toHaveLength(1);
    expect(adapter.state.player1.base.damage).toBe(0);
  });

  it("self-exhaustion: an exhausted resource contributes nothing to payment", async () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, "SHD_086", 1, false)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 5)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.groundArena).toHaveLength(1);
    const readyResources = adapter.state.player1.resources.filter(r => r.ready);
    expect(readyResources).toHaveLength(1);
  });

  it("aspect penalty applies to Smuggle cost", async () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .FillResourcesForPlayer(1, "SHD_086", 1)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 9)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.groundArena).toHaveLength(1);
    const readyResources = adapter.state.player1.resources.filter(r => r.ready);
    expect(readyResources).toHaveLength(2);
  });

  it("invalid: not enough ready resources", async () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, "SHD_086", 1)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 1)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.groundArena).toHaveLength(0);
    expect(adapter.state.player1.resources).toHaveLength(2);
  });
});

describe("Smuggle — Tech passive integration", () => {
  it("Tech in play: can Smuggle a card that has no own Smuggle", async () => {
    // SOR_066 (System Patrol Craft): no own Smuggle.
    // Tech path: CardCost(SOR_066)+2, no aspect penalty if aspects covered.
    // Player needs enough ready resources.
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .WithGroundUnitForPlayer(1, Cards.units.shd.tech)
      .FillResourcesForPlayer(1, "SOR_066", 1)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 7)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.spaceArena.some(u => u.cardId === "SOR_066")).toBe(true);
  });

  it("Tech in play: Chewbacca uses own Smuggle (9) when player has Aggression+Heroism", async () => {
    // Sabine (Aggression+Heroism) + blue30HP (Vigilance) = Aggression+Heroism+Vigilance
    // Own Smuggle [Aggression,Heroism]: 9+0=9. Tech [Heroism,Vigilance]: 8+2+0=10. Min=9.
    // Need 9 ready resources (including Chewbacca itself).
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.tech)
      .FillResourcesForPlayer(1, Cards.units.shd.chewbaccaPykesbane, 1)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 9)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.groundArena.some(u => u.cardId === "SHD_050")).toBe(true);
    // Cost=9. Self (ready) contributes 1. 8 others exhausted. 9-8=1 ready remaining.
    const readyResources = adapter.state.player1.resources.filter(r => r.ready);
    expect(readyResources).toHaveLength(1);
  });

  it("Tech in play: Chewbacca uses Tech path (10) when player has Heroism+Vigilance not Aggression", async () => {
    // Chewbacca leader (Vigilance+Heroism) + blue30HP (Vigilance) = 2×Vigilance+Heroism
    // Own Smuggle [Aggression,Heroism]: missing Aggression → 9+2=11. Tech: 8+2+0=10. Min=10.
    // Need 10 ready resources (including Chewbacca resource itself).
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.chewbacca)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.tech)
      .FillResourcesForPlayer(1, Cards.units.shd.chewbaccaPykesbane, 1)
      .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 10)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.groundArena.some(u => u.cardId === "SHD_050")).toBe(true);
    // Cost=10. Self contributes 1. 9 others exhausted. 10-9=1 ready remaining.
    const readyResources = adapter.state.player1.resources.filter(r => r.ready);
    expect(readyResources).toHaveLength(1);
  });

  it("Tech in play: DJ always uses Tech path (5 < 7 own Smuggle)", async () => {
    // Cad Bane (Cunning+Villainy) + yellow30HP (Cunning) = 2×Cunning+Villainy
    // Own Smuggle [Cunning,Cunning]: 7+0=7. Tech [Cunning]: 3+2+0=5. Min=5.
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.tech)
      .FillResourcesForPlayer(1, Cards.units.shd.djBlatantThief, 1)
      .FillResourcesForPlayer(1, Cards.bases.common.yellow30HP, 5)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.groundArena.some(u => u.cardId === "SHD_213")).toBe(true);
    // Cost=5. Self contributes 1. 4 exhausted. 5-4=1 ready remaining.
    const readyResources = adapter.state.player1.resources.filter(r => r.ready);
    expect(readyResources).toHaveLength(1);
  });

  it("Tech in play: Tech-on-Tech uses own Smuggle (4 < Tech path 5)", async () => {
    // Leia (Command+Heroism) + green30HP (Command) = 2×Command+Heroism
    // Own Smuggle [Heroism]: 4+0=4. Tech [Heroism]: 3+2+0=5. Min=4.
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.blue30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.shd.tech)
      .FillResourcesForPlayer(1, Cards.units.shd.tech, 1)
      .FillResourcesForPlayer(1, Cards.bases.common.green30HP, 4)
      .Build();

    const adapter = new GameTestAdapter();
    adapter.loadNewState(state);
    await adapter.smuggleResourceAsync(1, 0);

    expect(adapter.state.player1.groundArena.filter(u => u.cardId === "SHD_248")).toHaveLength(2);
    // Cost=4. Self contributes 1. 3 exhausted. 4-3=1 ready remaining.
    const readyResources = adapter.state.player1.resources.filter(r => r.ready);
    expect(readyResources).toHaveLength(1);
  });
});
