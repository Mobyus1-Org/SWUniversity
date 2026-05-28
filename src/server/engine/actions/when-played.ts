import { PlayerId } from "@/lib/engine/core-models";
import { CanDisclose, DrawCardForPlayer, GetGame, GetUnitsForPlayer, TraitContains, CardIsLeader } from "@/server/engine/core-functions";
import { PendingResolution, ReturnFromDiscardPending, SpreadDamagePending, GiveXpMultiplePending, ChooseIndirectTargetPending, DeckSearchPending } from "@/server/engine/pending-resolution";
import { Unit } from "@/server/engine/unit";
import { CreateBattleDroid, CreateCloneTrooper, CreateXWing, CreateSpy } from "@/server/engine/token-helpers";
import { CardAspects, CardCost, CardTitle, CardType } from "@/server/engine/card-db/generated";

/**
 * When Played abilities for unit cards.
 * Return a PendingResolution if further input is needed, or null to auto-resolve.
 */
export function resolveWhenPlayed(
  cardId: string,
  player: PlayerId,
  playId?: string,
): PendingResolution | null {
  const game = GetGame();
  if (!game) throw new Error("Game not found in resolveWhenPlayedAbility");
  switch (cardId) {
    case "SOR_033": //Death Trooper "Deal 2 damage to a friendly ground unit and 2 damage to an enemy ground unit."
    case "SEC_030": {// reprint of SOR_033
      const friendlyGround = player === 1 ? game.currentGameState.player1.groundArena : game.currentGameState.player2.groundArena;
      const enemyGround = player === 1 ? game.currentGameState.player2.groundArena : game.currentGameState.player1.groundArena;
      if (friendlyGround.length === 0 || enemyGround.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendlyGround.map(u => u.playId),
        continuation: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: enemyGround.map(u => u.playId),
          continuation: null,
        },
      };
    }
    case "SOR_227": // Snowtrooper Lieutenant — You may attack with a unit. If Imperial, gets +2/+0 for this attack.
    case "SHD_236": {
      const readyFriendly = GetUnitsForPlayer(player, true).map(u => u.playId);
      if (readyFriendly.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Attack with a unit? Imperial units get +2/+0.",
        yesLabel: "Attack",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: readyFriendly,
          continuation: null,
        },
        continuation: null,
      };
    }
    case "SOR_103": { //Rebel Assault "Attack with a Rebel unit. It gets +1/+0 for this attack. Then, attack with another Rebel unit. It gets +1/+0 for this attack."
      const rebelPlayIds = GetUnitsForPlayer(player, true).filter((u) =>
        TraitContains(u.cardId, "Rebel", u.controller, u.playId)).map((u) => u.playId);
      if (rebelPlayIds.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: rebelPlayIds,
        continuation: {
          type: "ability-target",
          cardId,
          fromPlayIds: rebelPlayIds,
          continuation: null,
        }
      };
    }
    case "SHD_129": {//Timely Intervention: Play a unit from your hand. Give it Ambush for this phase.
      const game129 = GetGame();
      if (!game129) throw new Error("Game not found in SHD_129 resolution.");
      const playerHand = player === 1 ? game129.currentGameState.player1.hand : game129.currentGameState.player2.hand;
      const handUnits = playerHand.filter(c => CardType(c.cardId) === "Unit");
      if (handUnits.length === 0) return null;
      return {
        type: "play-from-hand",
        cardId,
        player,
      };
    }
    case "SOR_162": //Disabling Fang Fighter: You may defeat an upgrade.
    case "SHD_166": //reprint of SOR_162
      if (!playId && !player) return null;
      const allUpgradePlayIds = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .flatMap(u => u.upgrades.map(upg => upg.playId));
      if (allUpgradePlayIds.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Defeat an upgrade?",
        yesLabel: "Defeat",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: allUpgradePlayIds,
          continuation: null,
        },
        continuation: null,
      }
    case "SOR_168": //Precision Fire "Attack with a unit. It gains Saboteur for this attack. If it's a Trooper, it also gets +2/+0 for this attack. (Ignore Sentinel and defeat the defender's Shields.)"
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: GetUnitsForPlayer(player, true).map((u) => u.playId),
        continuation: null,
      }
    case "JTL_153": //Rebellious Hammerhead "When Played: You may deal damage to a unit equal to the number of cards in your hand."
      if (!playId && !player) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Deal damage to a unit equal to the number of cards in your hand?",
        yesLabel: "Deal Damage",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          sourcePlayId: playId!,
          // Populate all units from both players (including itself — it's already in the arena)
          fromPlayIds: [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)].map((u) => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    case "SEC_034": { // Cad Bane — "When Played: You may defeat a unit with 2 or less remaining HP."
      const allUnits = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      const eligible = allUnits.filter(u => Unit.FromInterface(u).CurrentHP() <= 2);
      if (eligible.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        fromPlayIds: eligible.map(u => u.playId),
        continuation: null,
      };
    }
    case "SHD_160": //Reckless Gunslinger "When Played: Deal 1 damage to each base."
      return null;
    case "TWI_237": { // Droid Deployment — "Create 2 Battle Droid tokens."
      const gs237 = game.currentGameState;
      CreateBattleDroid(gs237, player);
      CreateBattleDroid(gs237, player);
      game.gameLog.push(`${CardTitle(cardId)}: 2 Battle Droid tokens created.`);
      return null;
    }
    case "TWI_251": { // Drop In — "Create 2 Clone Trooper tokens."
      const gs251 = game.currentGameState;
      CreateCloneTrooper(gs251, player);
      CreateCloneTrooper(gs251, player);
      game.gameLog.push(`${CardTitle(cardId)}: 2 Clone Trooper tokens created.`);
      return null;
    }
    case "JTL_254": { // Dedicated Wingmen — "Create 2 X-Wing tokens."
      const gs254 = game.currentGameState;
      CreateXWing(gs254, player);
      CreateXWing(gs254, player);
      game.gameLog.push(`${CardTitle(cardId)}: 2 X-Wing tokens created.`);
      return null;
    }
    case "SEC_082": // Chancellor Palpatine — When Played: handled in when-played-trigger.ts
    case "SEC_083": // ISB Shuttle — When Played: handled in when-played-trigger.ts
      return null;
    case "SEC_092": { // I Am the Senate — "Create 5 Spy tokens."
      const gs092 = game.currentGameState;
      for (let i = 0; i < 5; i++) CreateSpy(gs092, player);
      game.gameLog.push(`${CardTitle(cardId)}: 5 Spy tokens created.`);
      return null;
    }
    case "SOR_073": { // Moment of Peace — "Give a Shield token to a unit."
      const allUnits073 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      if (allUnits073.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allUnits073.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_241": { // Wing Leader — "When Played: Give 2 Experience tokens to another friendly REBEL unit."
      const friendlyRebels241 = GetUnitsForPlayer(player, true)
        .filter(u => u.playId !== playId && TraitContains(u.cardId, "Rebel", u.controller, u.playId));
      if (friendlyRebels241.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        sourcePlayId: playId,
        fromPlayIds: friendlyRebels241.map(u => u.playId),
        continuation: null,
      };
    }
    case "TWI_128": { // Take Captive "A friendly unit captures an enemy non-leader unit in the same arena."
      const friendlyUnits = GetUnitsForPlayer(player, true);
      if (friendlyUnits.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendlyUnits.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_224": { // Change of Heart — "Take control of a non-leader unit."
      const allNonLeaders = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => !CardIsLeader(u.cardId));
      if (allNonLeaders.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allNonLeaders.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_222": { // Waylay — "Return a non-leader unit to its owner's hand."
      const allNonLeaders = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => !CardIsLeader(u.cardId));
      if (allNonLeaders.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allNonLeaders.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_176":
    case "SEC_184": { // ISB Agent — "When Played: You may reveal an event from your hand. If you do, deal 1 damage to a unit."
      const pStateIsb = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const hasEvent = pStateIsb.hand.some(c => CardType(c.cardId) === "Event");
      if (!hasEvent) return null;
      const allUnitsIsb = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      if (allUnitsIsb.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Reveal an event from your hand to deal 1 damage to a unit?",
        yesLabel: "Reveal",
        noLabel: "Skip",
        onYes: {
          type: "play-from-hand",
          cardId,
          player,
        },
        continuation: null,
      };
    }
    case "SOR_252": { // Restock — "Choose up to 4 cards in a discard pile. Put them on the bottom of their owner's deck in a random order."
      const gs252 = game.currentGameState;
      const combined = [...gs252.player1.discard, ...gs252.player2.discard];
      if (combined.length === 0) return null;
      return {
        type: "return-from-discard",
        cardId: "SOR_252",
        player,
        maxCount: 4,
        eligiblePlayIds: combined.map(d => d.playId),
        continuation: null,
      } satisfies ReturnFromDiscardPending;
    }
    case "SEC_062": { // Bardottan Ornithopter — "When Played: You may disclose Vigilance. If you do, draw a card."
      if (!CanDisclose(player, ["Vigilance"])) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Disclose Vigilance to draw a card?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: { type: "play-from-hand", cardId, player },
        continuation: null,
      };
    }
    case "SEC_181": { // Unauthorized Investigation — "Create a Spy token. You may disclose Aggression. If you do, create another Spy token."
      const gs181 = game.currentGameState;
      CreateSpy(gs181, player);
      game.gameLog.push(`${CardTitle(cardId)}: created a Spy token.`);
      if (!CanDisclose(player, ["Aggression"])) return null;
      return {
        type: "ability-option",
        cardId,
        helperText: "Disclose Aggression to create another Spy token?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: { type: "play-from-hand", cardId, player },
        continuation: null,
      };
    }
    case "SEC_182": { // Charged with Treason — "You may disclose AggressionAggression. If you do, deal 5 damage to a unit."
      if (!CanDisclose(player, ["Aggression", "Aggression"])) return null;
      return {
        type: "ability-option",
        cardId,
        helperText: "Disclose AggressionAggression to deal 5 damage to a unit?",
        yesLabel: "Disclose",
        noLabel: "Skip",
        onYes: { type: "play-from-hand", cardId, player },
        continuation: null,
      };
    }
    case "SOR_219": { // Sneak Attack — "Play a unit from your hand. It costs 3 less and enters play ready. At the start of the regroup phase, defeat it."
      const pState219 = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const hasUnit219 = pState219.hand.some(c => CardType(c.cardId) === "Unit");
      if (!hasUnit219) return null;
      return {
        type: "play-from-hand",
        cardId: "SOR_219",
        player,
      };
    }
    case "JTL_096": { // Blue Leader — "You may pay 2 resources. If you do, move this unit to the ground arena and give 2 Experience tokens to it."
      if (!playId) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: `Pay 2 resources to move ${CardTitle(cardId)} to the ground arena and give 2 Experience tokens?`,
        yesLabel: "Pay 2",
        noLabel: "Skip",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_150": { // Heroic Sacrifice — "Draw a card, then attack with a unit. It gets +2/+0 and dies when it deals combat damage."
      const game150 = game!;
      const gs150 = game150.currentGameState;
      const p150 = player === 1 ? gs150.player1 : gs150.player2;
      if (p150.deck.length > 0) {
        p150.hand.push(p150.deck.pop()!);
        game150.gameLog.push(`${CardTitle("SOR_150")}: drew a card.`);
      } else {
        p150.base.damage += 3;
        game150.gameLog.push(`${CardTitle("SOR_150")}: drew from empty deck — 3 damage to base.`);
      }
      const attackers150 = GetUnitsForPlayer(player, true);
      if (attackers150.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: attackers150.map(u => u.playId),
        continuation: null,
      };
    }
    case "SHD_132": { // Choose Sides — "Choose a friendly non-leader unit and an enemy non-leader unit. Exchange control of those units."
      const friendly132 = GetUnitsForPlayer(player).filter(u => !CardIsLeader(u.cardId));
      if (friendly132.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendly132.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_092": { // Overwhelming Barrage — choose a friendly unit to buff and spread damage
      const friendly092 = GetUnitsForPlayer(player);
      if (friendly092.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendly092.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_127": { // Strike True — "A friendly unit deals damage equal to its power to an enemy unit."
      const friendlyUnits127 = GetUnitsForPlayer(player);
      if (friendlyUnits127.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendlyUnits127.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_251": { // Confiscate — "Defeat an upgrade."
      const allUpgradePlayIds = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .flatMap(u => u.upgrades.map(upg => upg.playId));
      if (allUpgradePlayIds.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allUpgradePlayIds,
        continuation: null,
      };
    }
    case "SOR_077": { // Takedown — "Defeat a unit with 5 or less remaining HP."
      const eligible077 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => Unit.FromInterface(u).CurrentHP() <= 5);
      if (eligible077.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: eligible077.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_078": // Vanquish — "Defeat a non-leader unit."
    case "TWI_077": { // reprint of SOR_078
      const eligible078 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => !Unit.FromInterface(u).IsLeader());
      if (eligible078.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: eligible078.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_135": { // Emperor Palpatine — When Played: Deal 6 damage divided as you choose among enemy units.
      const enemies135 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (enemies135.length === 0) return null;
      return {
        type: "spread-damage",
        cardId,
        player,
        totalDamage: 6,
        optional: false,
        eligiblePlayIds: enemies135.map(u => u.playId),
        continuation: null,
      } satisfies SpreadDamagePending;
    }
    case "TWI_229": { // Battle Droid Escort — "When Played: Create a Battle Droid token."
      const gs229 = game.currentGameState;
      CreateBattleDroid(gs229, player);
      game.gameLog.push(`${CardTitle(cardId)}: Battle Droid token created.`);
      return null;
    }
    case "TWI_190": { // On the Doorstep — "Create 3 Battle Droid tokens and ready them."
      const gs190 = game.currentGameState;
      const d1 = CreateBattleDroid(gs190, player);
      const d2 = CreateBattleDroid(gs190, player);
      const d3 = CreateBattleDroid(gs190, player);
      d1.ready = true;
      d2.ready = true;
      d3.ready = true;
      game.gameLog.push(`${CardTitle(cardId)}: 3 Battle Droid tokens created and readied.`);
      return null;
    }
    case "TWI_086": { // Admiral Trench — "When Played: Return up to 3 units that were defeated this phase from your discard pile to your hand."
      const gs086 = game.currentGameState;
      const playerState086 = player === 1 ? gs086.player1 : gs086.player2;
      const defeatedPlayIds086 = new Set(
        gs086.roundState.cardsLeftPlayThisPhase
          .filter(c => c.fromPlayer === player && c.reason === "defeated")
          .map(c => c.playId)
      );
      const eligible086 = playerState086.discard
        .filter(d => defeatedPlayIds086.has(d.playId))
        .map(d => d.playId);
      if (eligible086.length === 0) return null;
      return {
        type: "return-from-discard",
        cardId,
        player,
        maxCount: 3,
        eligiblePlayIds: eligible086,
        continuation: null,
      } satisfies ReturnFromDiscardPending;
    }
    case "SOR_106": { // Attack Pattern Delta
      const friendlies = GetUnitsForPlayer(player);
      if (friendlies.length === 0) return null;
      const allIds = friendlies.map(u => u.playId);
      return {
        type: "ability-target",
        cardId: "SOR_106_3",
        player,
        fromPlayIds: allIds,
        continuation: {
          type: "ability-target",
          cardId: "SOR_106_2",
          player,
          fromPlayIds: allIds, // stale — refreshed in applyAbilityEffect for SOR_106_3
          continuation: {
            type: "ability-target",
            cardId: "SOR_106_1",
            player,
            fromPlayIds: allIds, // stale — refreshed in applyAbilityEffect for SOR_106_2
            continuation: null,
          },
        },
      };
    }
    case "SOR_080": // General Tagge — When Played: Give an Experience token to each of up to 3 TROOPER units.
    case "SHD_081": { // reprint of SOR_080
      const game080 = GetGame();
      if (!game080) return null;
      const gs080 = game080.currentGameState;
      const troopers = [
        ...gs080.player1.groundArena, ...gs080.player1.spaceArena,
        ...gs080.player2.groundArena, ...gs080.player2.spaceArena,
      ].filter(u => TraitContains(u.cardId, "Trooper", u.controller, u.playId));
      if (troopers.length === 0) return null;
      return {
        type: "give-xp-multiple",
        cardId,
        player,
        maxCount: 3,
        eligiblePlayIds: troopers.map(u => u.playId),
        continuation: null,
      } satisfies GiveXpMultiplePending;
    }
    case "JTL_106": { // Unity of Purpose — For each friendly unit with a different name, give each unit you control +1/+1 for this phase.
      const gs106 = game.currentGameState;
      const friendlyUnits106 = player === 1
        ? [...gs106.player1.groundArena, ...gs106.player1.spaceArena]
        : [...gs106.player2.groundArena, ...gs106.player2.spaceArena];
      const distinctCount106 = new Set(friendlyUnits106.map(u => u.cardId)).size;
      if (distinctCount106 === 0) return null;
      for (let i = 0; i < distinctCount106; i++) {
        gs106.currentEffects.push({
          cardId: "JTL_106",
          duration: "Phase",
          affectedPlayer: player,
        });
      }
      game.gameLog.push(`${CardTitle(cardId)}: giving each friendly unit +${distinctCount106}/+${distinctCount106} for this phase.`);
      return null;
    }
    case "JTL_234": // Torpedo Barrage — Deal 5 indirect damage to a player.
      return {
        type: "choose-indirect-target",
        cardId,
        sourcePlayer: player,
        totalDamage: 5,
      } satisfies ChooseIndirectTargetPending;
    case "SOR_087": { // Darth Vader — Search top 10 of deck for Villainy units with combined cost ≤ 3, play each for free.
      const gs087 = game.currentGameState;
      const deck087 = player === 1 ? gs087.player1.deck : gs087.player2.deck;
      if (deck087.length === 0) return null;
      const count087 = Math.min(10, deck087.length);
      const top10_087 = deck087.slice(-count087);
      const topCards087 = top10_087.map((c, i) => ({ tempId: `${i}`, cardId: c.cardId }));
      const eligibleChoices087 = topCards087
        .filter(c => CardType(c.cardId) === "Unit" && CardAspects(c.cardId).includes("Villainy") && (CardCost(c.cardId) ?? 0) <= 3)
        .map(c => ({ ...c, cost: CardCost(c.cardId) ?? 0 }));
      if (eligibleChoices087.length === 0) {
        game.gameLog.push(`${CardTitle("SOR_087")}: no eligible Villainy units in the top ${count087} cards.`);
        return null;
      }
      return {
        type: "deck-search",
        cardId: "SOR_087",
        player,
        topCards: topCards087,
        eligibleChoices: eligibleChoices087,
        maxCombinedCost: 3,
        costModifier: 'free',
        action: "play",
        continuation: null,
      } satisfies DeckSearchPending;
    }
    case "SOR_104": { // U-Wing Reinforcement — Search top 10 of deck for up to 3 units with combined cost ≤ 7, play each for free.
      const gs104 = game.currentGameState;
      const deck104 = player === 1 ? gs104.player1.deck : gs104.player2.deck;
      if (deck104.length === 0) return null;
      const count104 = Math.min(10, deck104.length);
      const top10_104 = deck104.slice(-count104);
      const topCards104 = top10_104.map((c, i) => ({ tempId: `${i}`, cardId: c.cardId }));
      const eligibleChoices104 = topCards104
        .filter(c => CardType(c.cardId) === "Unit" && (CardCost(c.cardId) ?? 0) <= 7)
        .map(c => ({ ...c, cost: CardCost(c.cardId) ?? 0 }));
      if (eligibleChoices104.length === 0) {
        game.gameLog.push(`${CardTitle("SOR_104")}: no eligible units in the top ${count104} cards.`);
        return null;
      }
      return {
        type: "deck-search",
        cardId: "SOR_104",
        player,
        topCards: topCards104,
        eligibleChoices: eligibleChoices104,
        maxChoices: 3,
        maxCombinedCost: 7,
        costModifier: 'free',
        action: "play",
        continuation: null,
      } satisfies DeckSearchPending;
    }
    case "SOR_123": { // Recruit — Search top 5 of deck for a unit, reveal it, and draw it.
      const gs123 = game.currentGameState;
      const deck123 = player === 1 ? gs123.player1.deck : gs123.player2.deck;
      if (deck123.length === 0) return null;
      const count123 = Math.min(5, deck123.length);
      const top5_123 = deck123.slice(-count123);
      const topCards123 = top5_123.map((c, i) => ({ tempId: `${i}`, cardId: c.cardId }));
      const eligibleChoices123 = topCards123
        .filter(c => CardType(c.cardId) === "Unit")
        .map(c => ({ ...c, cost: CardCost(c.cardId) ?? 0 }));
      if (eligibleChoices123.length === 0) {
        game.gameLog.push(`${CardTitle("SOR_123")}: no units in the top ${count123} cards.`);
        return null;
      }
      return {
        type: "deck-search",
        cardId: "SOR_123",
        player,
        topCards: topCards123,
        eligibleChoices: eligibleChoices123,
        maxChoices: 1,
        action: "draw",
        continuation: null,
      } satisfies DeckSearchPending;
    }
    case "SOR_039": // AT-AT Suppressor — When Played: Exhaust all ground units. (auto-resolves in when-played-trigger)
      return null;
    case "SOR_111": // Patrolling V-Wing — When Played: Draw a card. (auto-resolves in when-played-trigger)
      return null;
    case "SOR_132": { // Imperial Interceptor — When Played: You may deal 3 damage to a space unit.
      const gs132 = game.currentGameState;
      const spaceUnits132 = [...gs132.player1.spaceArena, ...gs132.player2.spaceArena];
      if (spaceUnits132.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Deal 3 damage to a space unit?",
        yesLabel: "Deal 3",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: spaceUnits132.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    }
    case "SOR_134": { // Ruthless Raider — When Played/When Defeated: Deal 2 to enemy base + 2 to an enemy unit.
      const gs134 = game.currentGameState;
      const oppState134 = player === 1 ? gs134.player2 : gs134.player1;
      oppState134.base.damage += 2;
      game.gameLog.push(`${CardTitle(cardId)}: dealt 2 damage to opponent's base.`);
      const enemyUnits134 = [...oppState134.groundArena, ...oppState134.spaceArena];
      if (enemyUnits134.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: enemyUnits134.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_189": { // Leia Organa — When Played: Either ready a resource or exhaust a unit.
      const pState189 = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      const exhaustedResources189 = pState189.resources.filter(r => !r.ready);
      const allReadyUnits189 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)].filter(u => u.ready);
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Ready a resource (Yes) or exhaust a unit (No)?",
        yesLabel: "Ready a resource",
        noLabel: "Exhaust a unit",
        onYes: exhaustedResources189.length > 0 ? {
          type: "ability-target",
          cardId: "SOR_189_ready",
          player,
          fromPlayIds: exhaustedResources189.map(r => r.playId),
          continuation: null,
        } : null,
        continuation: allReadyUnits189.length > 0 ? {
          type: "ability-target",
          cardId: "SOR_189_exhaust",
          player,
          fromPlayIds: allReadyUnits189.map(u => u.playId),
          continuation: null,
        } : null,
      };
    }
    case "SOR_202": { // Cantina Bouncer — When Played: You may return a non-leader unit to its owner's hand.
      const nonLeaders202 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => !CardIsLeader(u.cardId));
      if (nonLeaders202.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Return a non-leader unit to its owner's hand?",
        yesLabel: "Bounce",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: nonLeaders202.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    }
    case "SOR_076": { // Make an Opening — Give a unit –2/–2 for this phase. Heal 2 from own base.
      const allUnits076 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      if (allUnits076.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allUnits076.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_124": { // Tactical Advantage — Give a unit +2/+2 for this phase.
      const allUnits124 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      if (allUnits124.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allUnits124.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_151": { // Karabast — A friendly unit deals damage equal to damage on it + its power to an enemy unit.
      const friendlyUnits151 = GetUnitsForPlayer(player);
      const enemyUnits151 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (friendlyUnits151.length === 0 || enemyUnits151.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: friendlyUnits151.map(u => u.playId),
        continuation: {
          type: "ability-target",
          cardId: "SOR_151_deal",
          player,
          fromPlayIds: enemyUnits151.map(u => u.playId),
          continuation: null,
        },
      };
    }
    case "SOR_169": { // Keep Fighting — Ready a unit with 3 or less power.
      const eligible169 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => new Unit(u.cardId, u.playId, u.controller).CurrentPower() <= 3);
      if (eligible169.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: eligible169.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_170": { // Power Failure — Defeat any number of upgrades on a unit.
      const unitsWithUpgrades170 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)]
        .filter(u => u.upgrades.length > 0);
      if (unitsWithUpgrades170.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: unitsWithUpgrades170.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_171": { // Mission Briefing — Choose a player. They draw 2 cards.
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Who draws 2 cards?",
        yesLabel: "You draw 2",
        noLabel: "Opponent draws 2",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_172": { // Open Fire — Deal 4 damage to a unit.
      const allUnits172 = [...GetUnitsForPlayer(1), ...GetUnitsForPlayer(2)];
      if (allUnits172.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: allUnits172.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_173": { // Bombing Run — Choose an arena. Deal 3 damage to each unit in that arena.
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Choose an arena: Ground (Yes) or Space (No)?",
        yesLabel: "Ground",
        noLabel: "Space",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_216": { // Disarm — Give an enemy unit –4/–0 for this phase.
      const enemyUnits216 = GetUnitsForPlayer(player === 1 ? 2 : 1);
      if (enemyUnits216.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: enemyUnits216.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_220": { // Surprise Strike — Attack with a unit. It gets +3/+0 for this attack.
      const readyFriendly220 = GetUnitsForPlayer(player, true);
      if (readyFriendly220.length === 0) return null;
      return {
        type: "ability-target",
        cardId,
        player,
        fromPlayIds: readyFriendly220.map(u => u.playId),
        continuation: null,
      };
    }
    case "SOR_221": { // Outmaneuver — Choose an arena. Exhaust each unit in that arena.
      return {
        type: "ability-option",
        cardId,
        player,
        helperText: "Choose an arena: Ground (Yes) or Space (No)?",
        yesLabel: "Ground",
        noLabel: "Space",
        onYes: null,
        continuation: null,
      };
    }
    case "SOR_240": { // Fleet Lieutenant — When Played: You may attack with a unit. Rebels get +2/+0.
      const readyFriendly240 = GetUnitsForPlayer(player, true);
      if (readyFriendly240.length === 0) return null;
      return {
        type: "ability-option",
        cardId,
        sourcePlayId: playId,
        helperText: "Attack with a unit? Rebel units get +2/+0.",
        yesLabel: "Attack",
        noLabel: "Skip",
        onYes: {
          type: "ability-target",
          cardId,
          player,
          fromPlayIds: readyFriendly240.map(u => u.playId),
          continuation: null,
        },
        continuation: null,
      };
    }
    case "TWI_193": { // R2-D2 (Full of Solutions) — You may discard a card. If you do, search top 3 and draw a card.
      const pState193 = player === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
      if (pState193.hand.length === 0) return null;
      const deck193 = pState193.deck;
      if (deck193.length === 0) return null;
      const count193 = Math.min(3, deck193.length);
      const top3_193 = deck193.slice(-count193);
      const topCards193 = top3_193.map((c, i) => ({ tempId: `${i}`, cardId: c.cardId }));
      const eligibleChoices193 = topCards193.map(c => ({ ...c, cost: CardCost(c.cardId) ?? 0 }));
      const deckSearchCont: DeckSearchPending = {
        type: "deck-search",
        cardId: "TWI_193",
        player,
        topCards: topCards193,
        eligibleChoices: eligibleChoices193,
        maxChoices: 1,
        action: "draw",
        continuation: null,
      };
      return {
        type: "ability-option",
        cardId: "TWI_193",
        sourcePlayId: playId,
        helperText: "Discard a card from your hand to search the top 3 cards of your deck and draw a card?",
        yesLabel: "Discard",
        noLabel: "Skip",
        onYes: {
          type: "discard-from-hand",
          targetPlayer: player,
          count: 1,
          continuation: deckSearchCont,
        },
        continuation: null,
      };
    }
    case "LOF_100": { // Kelleran Beq — Search the top 7 cards of your deck for a unit, reveal it, and play it. It costs 3 resources less.
      const gs100 = game.currentGameState;
      const deck100 = player === 1 ? gs100.player1.deck : gs100.player2.deck;
      if (deck100.length === 0) return null;
      const count100 = Math.min(7, deck100.length);
      const top7_100 = deck100.slice(-count100);
      const topCards100 = top7_100.map((c, i) => ({ tempId: `${i}`, cardId: c.cardId }));
      const eligibleChoices100 = topCards100
        .filter(c => CardType(c.cardId) === "Unit")
        .map(c => ({ ...c, cost: CardCost(c.cardId) ?? 0 }));
      if (eligibleChoices100.length === 0) {
        game.gameLog.push(`${CardTitle("LOF_100")}: no eligible units in the top ${count100} cards.`);
        return null;
      }
      return {
        type: "deck-search",
        cardId: "LOF_100",
        player,
        topCards: topCards100,
        eligibleChoices: eligibleChoices100,
        maxChoices: 1,
        costModifier: -3,
        action: "play",
        continuation: null,
      } satisfies DeckSearchPending;
    }
    default:
      return null;
  }
}