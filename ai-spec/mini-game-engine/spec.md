# Overview
Create a mini game engine to simulate playing Star Wars Unlimited in the browser. This will be a 1-player vs CPU style game. For now, no bot logic for the CPU. The first intention for this mini game is for a puzzle mode that involves the user making decisions after the opponent has claimed initiative and will undoubtedly win next action phase. A puzzle is considered "complete" when Player 1 reaches the win condition of dealing damage to the opponent's base equal to the base's HP. Puzzles for now will always begin with Player 1's base at 6 or less health. This creates the urgency to win this round because during the Regroup Draw step they will take 6 damage to the base per the SWU rule that if no cards are left in deck, then you take 3 damage for each card that you couldn't draw.

A puzzle is considered "failed" if Player 1 has not won by the end of the Regroup Draw step, after all mandatory draw processing and empty-deck damage for that step has resolved.

# Prerequisites
- PRE-1: Read the how-to-play.md located sibling to this spec.
- PRE-2: Read the game-refs.md located sibling to this spec.
- PRE-3: Analyze the puzzle.png image located sibling to this spec as well as its ref: simple-example.md

# Requirements
## Engine Requirements
At any time, there can only be one game going for a user.
### ENG-FEAT-1: Game zones
The following are game zones that will be used to determine game state. the board is split into two halves, one for the active player and one for the opponent. the hands of both players lie outside the board itself:
- My Base: my base card. this is the win condition of the game to get damage counters on the base equal to its health. some bases have epic actions that can be used once per game. once this action has been used, a yellow X marker is put on it to note the epic action has been used. this is positioned center top of the bottom half of the board.
- My Leader: my leader card from my deck. it can be either ready, exhausted, or deployed. if it is deployed, then it no longer shows up in this zone because it has moved to the ground arena. if a leader has already used their epic action to deploy, and was defeated or returned to this zone, then it will have a yellow X marker to note the epic action has been used. this is positioned center top of the bottom half of the board., below the base.
- My Supplemental Token Zone: a smaller area that holds special tokens. for example, the Force Token is a mechanic that will create a blue token icon that can be used as a cost for certain actions. and Credit tokens are a mechanic that can be used to pay for costs where resources are also paid with. the tokens for Credit tokens will be a dark yellow square with a counter on it for the number of Credits acquired. this zone is fairly large and will reside below the Leader zone for the active player. This will also be the space to display which player has the initiative. when the black initiative token is claimed, it will appear here.
- My Space Zone: this zone will be positioned to the left of the leader and base of the active player and be the space arena for space units that are played.
- My Ground Zone: this zone will be positioned to the right of the leader and base of the active player and be the ground arena for ground units that are played.
- My Resource Zone: this zone will be positioned at the bottom of the board and start from the left and will take up 5/8 of the space. this will be all the cards placed facedown to be used as resources to pay costs. resource cards can be either exhusted or ready.
- My Deck Zone: this zone will be positioned to the right of the active player's resource zone. it will show as a stack of facedown cards with a number on it for how many cards left in deck. if there are 0 cards, then it will show as empty.
- My Discard Zone: this zone will be position to the right of the active player's deck zone. if no cards here, then it will be empty. if there are cards here, then show the most recently discarded card, and put a counter on it with the total number of cards in discard.
- My Hand Zone: this zone will be positioned at the bottom of the screen, below the game board. these cards are visible to me. and i can choose them individually. when not hovered, it will only show the top halves of the cards. when hovered, then show them fully.
- Their Base: their base card. positioned in the bottom center of the top half of the gameboard. same mechanics apply to their base as well.
- Their Leader: their leader card. positioned in the bottom center of the top half of the gameboard, above their base zone. same mechanics apply to their leader as well.
- Their Supplemental Token Zone: opponent's area that holds special tokens. This will also be the space to display which player has the initiative. when the black initiative token is claimed, it will appear on their supplemental zone. it will be positioned above their leader zone.
- Their Space Zone: this zone will be positioned to the left of their leader and base and be the space arena for space units that are played.
- Their Ground Zone: this zone will be positioned to the right of their leader and base and be the ground arena for ground units that are played.
- Their Resource Zone: this zone will be positioned at the top of the board and start from the left and will take up 5/8 of the space. this will be all the cards placed facedown to be used as resources for the opponent. same mechanics apply to them.
- Their Deck Zone: this zone will be positioned to the right of their resource zone. it will show as a stack of facedown cards with a number on it for how many cards left in deck. if there are 0 cards, then it will show as empty.
- Their Discard Zone: this zone will be position to the right of their deck zone. if no cards here, then it will be empty. if there are cards here, then show the most recently discarded card, and put a counter on it with the total number of cards in discard.
- Their Hand Zone: this zone will be positioned at the top of the screen. the cards will not be visible to me and show only facedown cards with a logo on it.

### ENG-FEAT-2: Game state model
The game state will update every time an action is taken or when a card changes the game state. The full game state will look like
```ts
enum PlayerId {
  Player1 = 1,
  Player2 = 2
}

interface Card {
  cardId: string; //looks like SET_123
}

interface EpicActionCard extends Card {
  epicActionUsed: boolean;
}

interface CardInPlay extends Card {
  playId: string; //"@" token when stored, but looks like integers "2", "101", etc. when live
  owner: PlayerId;
  controller: PlayerId;
}

interface Unit extends CardInPlay {
  ready: boolean;
  damage:number; //int
  upgrades: CardInPlay[];
  captives: Unit[];
}

interface Base extends EpicActionCard {
  damage: number; //int
}

interface Leader extends EpicActionCard {
  ready: boolean;
  deployed: boolean;
}

interface Resource extends CardInPlay {
  ready: boolean;
  stolen?: boolean;
}

interface DiscardedCard extends CardInPlay {
  turnDiscarded: number; //int
  discardEffect: string; //one of "TTFREE, OTTFREE"
}

enum TriggerWindow {
  WhenPlayed,
  WhenCardPlayed,
  WhenUnitPlayed,
  OnAttack,
  OnDefense,
  WhenAttacked,
  CombatDamage,
  WhenCombatDamageDealt,
  WhenCaptured,
  WhenDefeated,
  WhenLeavesPlay,
  WhenAttackCompletes,
  RegroupDraw,
  RegroupResource,
  RegroupReady
}

enum EffectDuration {
  Phase,
  Round,
  Permanent
}

type PromptKind =
  | "ChooseAction"
  | "ChooseCardFromHand"
  | "ChoosePlayMode"
  | "ChooseTarget"
  | "ChooseLeaderAbilityOrDeploy"
  | "ChooseTriggerPlayerOrder"
  | "ChooseTriggerOrder"
  | "ChooseCostPayment";

interface PendingPromptChoice {
  id: string;
  label: string;
  player: PlayerId;
  playId?: string;
  cardId?: string;
  disabled?: boolean;
  reasonDisabled?: string;
}

interface PendingPrompt {
  id: string;
  player: PlayerId;
  kind: PromptKind;
  title: string;
  text?: string;
  choices: PendingPromptChoice[];
  minChoices: number;
  maxChoices: number;
  allowCancel?: boolean;
}

interface PendingAction {
  id: string;
  player: PlayerId;
  actionType: "PlayCard" | "Attack" | "ActionAbility" | "TakeInitiative" | "Pass";
  sourceCardId?: string;
  sourcePlayId?: string;
  selectedMode?: "Unit" | "Upgrade" | "Piloting" | "Event";
  selectedTargets?: string[];
  selectedCosts?: {
    resourcePlayIds?: string[];
    creditSpent?: number;
    exploitSacrificePlayIds?: string[];
    resourceLikeUnitExhaustPlayIds?: string[];
  };
}

interface CurrentEffect {
  cardId: string; //looks like SET_123
  duration: EffectDuration;
  affectedPlayer: PlayerId;
  targetPlayId?: string;
}

enum GamePhase {
  ActionPhase,
  RegroupDraw,
  RegroupResource,
  RegroupReady
}

interface TriggeredAbility {
  id: string;
  owner: PlayerId;
  controller: PlayerId;
  sourceCardId: string;
  sourcePlayId?: string;
  window: TriggerWindow;
  optional: boolean;
  requiresPrompt: boolean;
  stackDepth?: number;
  parentTriggeredAbilityId?: string;
  chosenTargets?: string[];
  payload: {
    keyword?: string;
    amount?: number;
    textRef?: string;
    effectType?: string;
  };
}

interface LastKnownInformation {
  sourcePlayId: string;
  sourceCardId: string;
  controller: PlayerId;
  owner: PlayerId;
  ready?: boolean;
  damage?: number;
  currentPower?: number;
  currentHP?: number;
  currentTraits: string[];
  currentKeywords: string[];
  attachedUpgradePlayIds?: string[];
  capturedUnitPlayIds?: string[];
}

interface CombatDefender {
  targetPlayId: string;
  isBase: boolean;
  damageReceived?: number;
}

interface BonusAttackConstraint {
  attackerFilter?: {
    trait?: string;
    controller?: PlayerId;
    allowExhausted?: boolean;
  };
  canTargetBase: boolean;
  remainingCount: number;
}

interface CombatChain {
  attackerPlayId: string;
  defenders: CombatDefender[];
  maxDefenders: number;
  canTargetBase: boolean;
  attackerPowerModifiers: number[];
  defenderPowerModifiers: Record<string, number[]>;
}

interface ComputedCardState {
  cardId: string;
  playId?: string;
  owner?: PlayerId;
  currentPower?: number;
  currentHP?: number;
  currentCost?: number;
  currentTraits: string[];
  currentKeywords: string[];
  canAttack: boolean;
  legalAttackTargets: string[];
  legalPlayModes?: Array<"Unit" | "Upgrade" | "Piloting" | "Event">;
  abilitiesSuppressed: boolean;
}

interface GameState {
  activePlayer: PlayerId;
  gamePhase: GamePhase;
  nextPlayId: number; //int; allocator for converting "@" placeholders and creating new in-play objects
  player1: {
    base: Base;
    leader: Leader;
    spaceArena: Unit[];
    groundArena: Unit[];
    resources: Resource[];
    discard: DiscardedCard[];
    deck: Card[];
    hand: Card[];
    supplemental: {
      forceToken?: boolean;
      creditTokens?: number; //int
    };
    lastActionWasPass?: boolean;
  };
  player2: {
    base: Base;
    leader: Leader;
    spaceArena: Unit[];
    groundArena: Unit[];
    resources: Resource[];
    discard: DiscardedCard[];
    deck: Card[];
    hand: Card[];
    supplemental: {
      forceToken?: boolean;
      creditTokens?: number; //int
    };
    lastActionWasPass?: boolean;
  };
  currentEffects: CurrentEffect[];
  currentRound: number; //int
  initiativePlayer: PlayerId;
  initiativeClaimed: boolean;
  triggerBag: TriggeredAbility[];
  pendingPrompt?: PendingPrompt;
  pendingAction?: PendingAction;
  combatChain?: CombatChain;
  bonusAttackConstraint?: BonusAttackConstraint;
  lastKnownInformationByPlayId?: Record<string, LastKnownInformation>;
}

interface Game {
  currentGameState: GameState;
  gameStateHistory: GameState[]; //max 10 states cached
  gameLog: string[];
}
```
Card definitions for MVP engine logic will come from the generated card database at src/server/engine/card-db/generated.ts.
all live `playId` properties will be strings derived from `nextPlayId`, incrementing monotonically as unique ids for that game instance.
"@" will be used, for pre-existing game states from the database, as a token to load and populate these playIds. when a puzzle is stored in the database, these will be stored as the "@" tokens. when loaded, the engine must walk the state, replace each "@" with `String(nextPlayId++)`, and persist the updated allocator in `currentGameState.nextPlayId`.
cards in either player's deck do not need a unique id.
cards in either player's hand do not need a unique id.
win condition is checked every time the game state changes.

Notes:
- `CurrentEffect` intentionally stays minimal and identity-based. Power, HP, keyword, trait, and suppression behavior should be resolved in query helpers and card-specific logic, consistent with the existing keyword dictionary pattern.
- `ComputedCardState` is a derived read model for legality checks and UI; it does not need to be persisted in `GameState`.
- `combatChain`, `bonusAttackConstraint`, `pendingPrompt`, and `pendingAction` are transient engine state and should be absent when not needed.
- `lastKnownInformationByPlayId` is used only to preserve data long enough for defeated / leaves-play / moved-out-of-play resolution.
- `nextPlayId` must be included in undo snapshots so restored history continues generating deterministic `playId` values without collisions.

the Game object must be able to be retrieved globally. this way can call into it with helper functions like
```ts
import { CardInPlay, Game, PlayerId } from "./core-models";

export function GetCardInPlay(playId: string, player?: PlayerId): CardInPlay | null {
  //const game = GetGame();
  const game = {} as Game; //TODO: replace with actual game state retrieval logic
  if (!game) {
    return null;
  }

  function collectNestedCards(cards: CardInPlay[]): CardInPlay[] {
    const collected: CardInPlay[] = [];
    for (const card of cards) {
      collected.push(card);

      if ("upgrades" in card && Array.isArray(card.upgrades)) {
        collected.push(...collectNestedCards(card.upgrades));
      }

      if ("captives" in card && Array.isArray(card.captives)) {
        collected.push(...collectNestedCards(card.captives));
      }
    }

    return collected;
  }

  function collectPlayerCards(targetPlayer: PlayerId): CardInPlay[] {
    const playerObj = targetPlayer === 1 ? game.currentGameState.player1 : game.currentGameState.player2;
    const topLevelCards: CardInPlay[] = [
      ...playerObj.spaceArena,
      ...playerObj.groundArena,
      ...playerObj.resources,
      ...playerObj.discard,
    ];

    return collectNestedCards(topLevelCards);
  }

  if(player) {
    const allCardsInPlay = collectPlayerCards(player);

    return allCardsInPlay.find(card => card.playId === playId) || null;
  } else {
    const allCardsInPlay = [
      ...collectPlayerCards(PlayerId.Player1),
      ...collectPlayerCards(PlayerId.Player2),
    ];

    return allCardsInPlay.find(card => card.playId === playId) || null;
  }
}
```

The exact helper implementation can vary, but lookup utilities must be able to find all live and recently relevant game objects referenced by `playId`, including arena units, resources, discard entries, attached upgrades/pilots, and captured units. Bases and undeployed leaders are not `CardInPlay` objects in this contract and should be accessed through dedicated state helpers rather than `GetCardInPlay`.

### ENG-FEAT-2.1: Ability registry contract
Card metadata from `generated.ts` is not enough to execute card behavior. The engine needs a registry for executable logic.

```ts
interface AbilityResolverContext {
  game: Game;
  sourcePlayer: PlayerId;
  sourceCardId: string;
  sourcePlayId?: string;
  pendingAction?: PendingAction;
}

type AbilityResolver = (ctx: AbilityResolverContext) => Promise<void> | void;

interface CardAbilityDefinition {
  cardId: string;
  whenPlayed?: AbilityResolver;
  onAttack?: AbilityResolver;
  onDefense?: AbilityResolver;
  whenCaptured?: AbilityResolver;
  whenDefeated?: AbilityResolver;
  whenLeavesPlay?: AbilityResolver;
  whenAttackCompletes?: AbilityResolver;
  actionAbility?: AbilityResolver;
  epicAction?: AbilityResolver;
}

type CardAbilityRegistry = Record<string, CardAbilityDefinition>;
```

Implementation direction:
- Use generic keyword resolvers where possible.
- Use per-card overrides only when a card cannot be represented by existing helpers.
- Puzzle cards can be implemented first without waiting for the full card pool.

### ENG-FEAT-3: Game mechanics and loops
#### ENG-FEAT-3.0: Trigger resolution and prompt determinism
- If the trigger bag count is 0, continue phase flow.
- If the trigger bag count is 1, auto-resolve without prompting.
- If the trigger bag count is greater than 1:
  - The active player chooses which player's triggers resolve first.
  - The chosen player resolves all triggered abilities they control in the order of their choice.
  - Then the other player resolves all triggered abilities they control in the order of their choice.
- Optional triggers may be skipped by their controller when chosen for resolution.
- If a resolving ability creates new triggers, treat them as a nested layer and resolve the nested layer fully before returning to the earlier layer.
- Triggered abilities still resolve after triggering even if the source leaves play, unless rules text explicitly prevents it.
- For hidden-zone triggers, reveal the card at trigger time for validation.
- If there is only one legal order or one legal prompt choice, the engine should not prompt.

#### ENG-FEAT-3.1: Playing a card
from the official SWU rules CR6:
```
2. PLAY A CARD
0. General
a. A player follows the steps below when they choose to take the Play a Card action on their turn, or when they resolve any ability that
lets them play a card. See 1.15. Actions
b. In order to play a card, a player must have a card in their hand or must be resolving an ability that allows them to play a card from
another zone. The player must be able to pay resources equal to the card’s cost, unless otherwise specified.
c. A player may play a card whose ability has no effect, so long as the act of paying the costs for and playing the card changes the
game state (e.g. the card is moved to a different zone).
d. Each time a player plays a card, that card enters play as a new copy of that card. See 8.6. Copy
e. Some action, event, and triggered abilities allow a player to play a card. Unless otherwise specified by the ability, the card must be
played from the player’s hand, and the player must pay all costs of the card when playing it this way. Any abilities that trigger while
playing and/or resolving the card resolve only after the current ability finishes resolving. The player is not considered to have taken
an additional action if they played a card due to an ability.
f. Playing a Card consists of the following 5 steps in order, explained in detail below: Declare intent, Check restrictions, Determine
cost(s), Pay cost(s), and Put card into play/discard. After playing the card, resolve any “When Played” abilities on the card and any
other abilities that triggered while playing and/or resolving the card, including Ambush and Shielded. See 7.6. Triggered Abilities
1. Declare intent. The player shows the card they intend to play from their hand, so that all other players can view it. Any abilities that
are active “while playing” a card become active, including any abilities granted to the played card by a modified “Play a Card” action.
a. When declaring intent, the player also declares how they intend to play the card, if it can be played as multiple card types. If
performing a modified Play a Card action that specifies the type of card to play, the intent must be to play that card in that way.
For example, a card with Piloting can be played as either a unit or an upgrade. If a player takes a modified Play a Card action that
specifies they must “play a unit,” they must declare the intent to play a card as a unit, and cannot use the Piloting keyword to
play that card as an upgrade.
2. Check restrictions. Determine if there are any active abilities, effects, or other play restrictions that would prevent the card from
being played at this time. If there are any, the card cannot be played.
a. Some abilities prevent the playing of a card or type of card. For example, Regional Governor (SOR #062) has an ability stating
opponents “can’t play” a named card; this is considered a “play restriction” for the named card.
b. If an upgrade uses the phrase “attach to,” the text following “attach to” indicates a type of unit that’s eligible for that upgrade; this is
a “play restriction” for that upgrade. If there are no units in play, no upgrades can be played. If there is no eligible unit in play for the
upgrade to attach to, the upgrade cannot be played.
c. An event can be played even if some or none of its abilities would change the game state.
d. If the active player has taken the Play a Card action, and their declared card cannot be played, that player must choose a different
eligible card to play or take a different action. If a player is taking a modified Play a Card action as instructed by an ability, and their
declared card cannot be played, that player must choose a different eligible card to play or end the modified Play a Card action
without playing a card.
3. Determine cost(s). A card’s cost is in the upper left corner of the card and indicates how many resources must be exhausted in order
to play it. Some abilities modify a card’s cost or apply additional costs to a card before it can be played.
a. When calculating a card’s modified cost, start with the card’s printed cost, then apply any modifiers that increase the cost of the
card (including the aspect penalty) before any modifiers that decrease the cost of the card, including abilities like Exploit. The
result is the card’s modified cost. See 8.16. Modifiers
b. A card’s cost cannot be modified below 0. If a card’s cost would be modified below 0, treat the cost as 0 instead.
c. If any abilities in effect apply an additional cost to play the card, also determine those costs at this time.
d. If an ability causes a card to be played “for free,” that ability overrides all resource costs to play that card, including the aspect
penalty. However, any additional non-resource costs applied to that card must still be paid.
e. Cost modifiers may be applied in whatever order the player playing the card chooses, as long as modifiers that increase the cost
are applied before modifiers that decrease the cost. This applies to constant modifiers as well as other modifiers like Exploit.
4. Pay cost(s). Exhaust resources equal to the card’s modified cost. If there are any additional costs required for the card, also pay
those now.
a. If any costs (including resource costs and additional costs) cannot be paid, cease this process without paying any costs. Return the
game state to the way it was before the first step.
b. A player cannot pay resources in excess of a card’s modified cost.
c. If a replacement effect replaces a cost with another effect, the cost is still considered paid as long as that other effect is resolved.
d. A player may pay costs in any order, so long as all costs are paid.
5. Put card into play/discard.
a. If the card is a unit, put it into play in its designated arena (ground or space), exhausted.
b. If the card is an upgrade, put it into play attached to an eligible unit.
c. If the card is an event, place the event in its owner’s discard pile, then resolve its ability. Resolve as much of its ability as possible
and ignore any parts of the ability that cannot resolve.
d. The card is considered “played” as soon as it enters play or, in the case of events, the discard pile.
```

Implementation notes:
- Play-card flow should materialize a `PendingAction` before payment begins.
- If a card has multiple legal play modes (for example, Piloting cards), use `ChoosePlayMode` only when there is more than one legal mode.
- Treat play-card execution as transactional. If any cost, target, or additional requirement fails during determination or payment, revert to the pre-action snapshot.
- Alternate costs such as discarding a qualifying card instead of paying the printed resource cost belong in cost determination / `ChooseCostPayment`, not in a generic replacement-effect system.

#### ENG-FEAT-3.2: Attacking with a unit
from the official SWU rules CR6:
```
0. General
a. A player follows the steps below when they choose to take the Attack With a Unit action on their turn, or when they resolve any
ability that lets them attack with a unit. See 1.15. Actions
b. Only one unit may attack at a time, and only ready units may perform an attack, unless otherwise specified. A player may only
attack with units they control and may only attack enemy units or enemy bases. If an attacking player loses control of the attacker
or gains control of the defender during an attack, proceed directly to the completion of the attack (after resolving any abilities that
have already triggered). These restrictions apply even if the attack is prompted by another ability. If an ability triggers multiple
attacks, resolve them sequentially.
c. “Combat damage” is damage dealt during the “Deal combat damage” step of an attack. Damage dealt outside of this step during an
attack is not considered to be combat damage. Damage dealt by triggered abilities is not considered combat damage.
d. Some action, event, and triggered abilities allow a player to attack with a unit. When resolving an ability that allows a player to
attack with a unit, the player must make an attack if possible. The player is not considered to have taken an additional action if they
attack due to an ability.
e. Attacking With a Unit consists of the following 3 steps in order, explained in detail below: Declare the attack, Deal combat damage,
and Complete the attack. After each step, resolve any abilities triggered during that step before proceeding to the next step in the
attack. See 7.6. Triggered Abilities
1. Declare the attack. The active player chooses and exhausts a ready unit they control and then chooses what to attack: either an
enemy unit in the same arena as it or the opponent’s base. Any abilities that are active “while attacking” become active.
a. If an ability prompts an attack, apply any “for this attack” lasting effects of the ability. If the effect impacts what the attacker can
attack, the player must choose a eligible unit or base to attack. If no such choice can be made, the attack immediately ends. If an
effect is contingent on which defender is chosen, the effect applies as soon as the defender is declared.
b. Only exhaust the attacker if there is an enemy unit or base that it can attack. If there is nothing for the attacker to attack, cease the
attack and return the game state to the way it was before this step.
c. The active player becomes the “attacking player” and the opponent that controls the enemy unit or base being attacked becomes
the “defending player” for this attack.
d. The unit performing the attack becomes the “attacker” for this attack. If the attacker is attacking an enemy unit, that unit becomes
the “defender” for this attack and the attacker is considered to be “attacking a unit” for the duration of this attack. If the attacker
is attacking a base, there is no “defender” for this attack and the attacker is considered to be “attacking a base” for the duration of
this attack.
e. If the defending player has one or more units with Sentinel in the same arena as the attacker, one of those units must be chosen
as the defender, unless the attacker has Saboteur, in which case it may ignore Sentinel.
f. Any abilities that activate while an attack is occurring become active for the duration of the attack. This includes Raid, “While this
unit is attacking,” and “While this unit is defending” abilities. If the ability is subject to a further conditional (e.g. “While this unit is
attacking a damaged unit”), it is only active while all of its conditions are true.
g. After declaring the attack, resolve any “On Attack” abilities on the attacker and any other abilities triggered during this step,
including Restore, Saboteur, and “When this unit is attacked” abilities on the defender. See 7.6. Triggered Abilities
2. Deal combat damage. If attacking a base, the attacker deals damage equal to its power to that base. If attacking a unit, the attacker
and defender simultaneously deal damage equal to their power to each other.
a. If the attacker is no longer in-play, no combat damage is dealt. Proceed directly to the next step of this attack.
b. If the defender is no longer in-play, no combat damage is dealt unless the attacker has Overwhelm.
c. If either unit that would be dealt damage has one or more Shield tokens attached to it, remove a Shield token from that unit and
don’t deal it any combat damage.
d. If the attacker has Overwhelm, deal its excess damage to the opponent’s base, unless the defender had a Shield token that
prevented the damage. This excess damage is dealt immediately and is considered combat damage. See 1.9. Damage
e. If the attacker has an ability where it deals combat damage before the defender, the defender must survive the dealt damage
before it can deal combat damage back to the attacker. In such a case, if the defender has Grit, it will receive bonus power from
the damage just dealt to it.
f. Once combat damage is dealt, if a unit has no remaining HP, it is defeated immediately.
g. After dealing all combat damage, resolve any “When Defeated” abilities on defeated units and any other abilities triggered during
this step, including “When this unit deals combat damage” and “When a unit leaves play” abilities. See 7.6. Triggered Abilities
3. Complete the attack. Any abilities or lasting effects that were active during the attack expire, including Raid and “While this unit is
attacking” abilities.
a. After completing the attack, resolve any “When this unit completes an attack” abilities (if the attacker is still in play) and any other
abilities triggered during this step. See 7.6. Triggered Abilities
```

Implementation notes:
- A `CombatChain` is the scoped state for a single attack. It is created when an attack is declared and discarded after the `WhenAttackCompletes` window resolves.
- One-shot "for this attack" buffs and damage formula overrides live on `CombatChain`, not in `currentEffects`.
- Raid is not stored as a persistent effect. It is evaluated during combat resolution when the engine knows the unit is the active attacker.
- If an ability grants extra attacks, resolve them sequentially as new `CombatChain` instances, not as one merged combat.

Special cases to support:
- Darth Maul `TWI_135` uses one `CombatChain` with `maxDefenders = 2`.
- Both defenders are part of one attack event; triggers happen once, not once per defender.
- Both defenders must be units. The attack cannot target a base and a unit simultaneously.
- If Sentinel applies and the attacker lacks Saboteur, all legal defender choices must satisfy Sentinel.
- If the attacker has Overwhelm, excess damage is the combined excess across both defenders.
- Follow-up attacks such as "When this unit completes an attack: You may attack with another Rebel unit" create a new prompted attack constrained by `BonusAttackConstraint`.
- Mass-attack text such as "attack with any number of other units, one at a time, even if exhausted" should be modeled as a temporary `bonusAttackConstraint` session that repeatedly spawns fresh `CombatChain` instances until the player passes or no legal attackers remain.

#### ENG-FEAT-3.3: Use an action ability
from the official SWU rules CR6:
```
4. USE AN ACTION ABILITY
0. General
a. A player follows the steps below when they choose to take the Use an Action Ability action on their turn, or when they resolve any
ability that lets them use an action ability. See 1.15. Actions
b. Action abilities are abilities that begin with the bold word “Action” or “Epic Action” followed by a cost in brackets, a colon, and an
ability following the colon. See 7.2.4. for more on Epic Actions
c. In order to use an action ability, a player must be able to pay the ability’s cost if it has one and change the game state through
paying that ability’s cost and/or resolving that ability’s effect.
d. A player may use an action ability whose effect does not change the game state, as long as paying the ability’s cost or resolving the
ability changes the game state
e. A player may use an action ability that references a particular kind of unit even if no such unit is in play, as long as paying the
ability’s cost or resolving the ability changes the game state.
f. A player may use a conditional action ability even if the condition is false, as long as paying the ability’s cost or resolving the ability
changes the game state.
For example, Iden Versio: Inferno Squad Commander (SOR #002) has an action ability that says “If an enemy unit was defeated
this phase, heal 1 damage from your base.” Iden’s controller may use this ability even if an enemy unit was not defeated this phase,
since the cost of the ability is exhausting Iden, which changes the game state. They would not heal any damage from their base.
g. Using an Action Ability consists of the following 5 steps in order, explained in detail below: Declare intent, Check restrictions,
Determine cost(s), Pay cost(s), and Resolve the ability. After using the action ability, resolve any abilities that triggered while using
the action ability. See 7.6. Triggered Abilities
1. Declare intent. The player indicates the ability they intend to resolve.
2. Check restrictions. Determine if there are any active abilities or other restrictions that would prevent the action ability from
resolving. If there are any, the action ability cannot be used.
a. One such restriction is that paying the cost of an action ability and/or resolving the action ability must change the game state in
some way. If neither would change the game state, the active player cannot attempt to use that ability and must take a different
action. See 1.16. Game State
3. Determine cost(s). If the ability has a cost, determine that cost at this step.
a. If an action ability has a cost, it is found in brackets following the word “Action.”
b. If an action ability cost uses the  icon, it means the card with the ability must exhaust in order to use the ability. If the cost does
not use the  icon, the card may use the ability whether it is ready or exhausted.
c. An action ability cost may include multiple parts, which are separated by commas within the brackets.
For example, Luke Skywalker: Faithful Friend (SOR #005) has an Action ability that requires you to pay 1 resource and exhaust
Luke. Paying 1 resource and exhausting Luke are both part of the ability’s cost, and both must be paid in order to use the ability.
4. Pay cost(s). Pay the ability’s determined cost, if it has one. If the action ability doesn’t have a cost, skip this step.
a. If any part of the cost cannot be paid, cease this process without paying any costs, and choose a different action to take.
b. A player cannot pay resources in excess of an ability’s determined cost.
c. If a replacement effect replaces a cost with another effect, the cost is still considered paid as long as that other effect is resolved.
5. Resolve the action ability. If the cost was successfully paid, resolve as much of the ability as possible and ignore any part of the
ability that cannot resolve.
a. If using the action ability results in an attack being made, resolve any abilities triggered during that attack at the appropriate
timing point within that attack. See 6.3 Attack With a Unit
b. If the effect of the ability does not change the game state, it still counts as the player’s action for their turn, so long as the cost of
the action ability changed the game state in some way.
```

Implementation notes:
- Action-ability flow should share the same prompt and transactional cost framework as play-card flow.
- If a leader can either deploy or resolve an action ability, the engine should surface `ChooseLeaderAbilityOrDeploy` only when both options are legal.
- If an action ability produces an attack, that attack runs through the normal `CombatChain` flow rather than an ad hoc shortcut.

#### ENG-FEAT-3.4: Mechanics representation decisions
- Piloting: represent a pilot as an upgrade-like `CardInPlay` attached to the host vehicle with its own `playId`.
- Capture: captured units live in `captives` and are out of play for targeting and attacks. If the captor leaves play, the captured unit is rescued and enters play under its owner's control, exhausted, unless card text says otherwise.
- Shield and Experience tokens: represent them as token upgrades in `unit.upgrades` using concrete token `cardId` values.
- Force and Credit tokens: keep them in `supplemental` state. Credit spending may be recorded in `PendingAction.selectedCosts.creditSpent`.
- Alternative cost sources: effects like Vuutun Palaa should be modeled as additional legal payment instruments in `selectedCosts`, not as normal resources.
- Smuggle and Plot: if played from the resource zone, the card enters play as a new in-play object with a new `playId`. The consumed resource identity does not persist as the new object.

#### ENG-FEAT-3.5: Legality, rollback, and pipeline interception
```ts
interface ActionError {
  code:
    | "INVALID_PHASE"
    | "NO_LEGAL_TARGET"
    | "INSUFFICIENT_RESOURCES"
    | "COST_PAYMENT_FAILED"
    | "ABILITY_SUPPRESSED"
    | "PROMPT_REQUIRED"
    | "ILLEGAL_ACTION";
  message: string;
}

interface ActionResult {
  ok: boolean;
  rolledBack?: boolean;
  prompt?: PendingPrompt;
  error?: ActionError;
}
```

- Enforce legality strictly for all implemented mechanics.
- Return an `ActionError` instead of silently failing.
- Treat multi-step actions as transactional: if a required cost or check fails, revert to the pre-action snapshot.
- Do not add a generic replacement-effect framework for MVP.
- Most "instead" text should be handled as one of the following:
  - resolver branching
  - alternate cost selection
  - combat-chain override
  - event-specific pipeline interception
- Event ownership should stay local to the relevant pipeline:
  - `applyDamage(...)` handles prevention, redirection, and damage-formula overrides before damage is committed.
  - `attemptDefeat(...)` handles defeat-prevention or alternate-exit logic before moving a card out of play.
  - `attemptCapture(...)` handles capture overrides before a unit becomes captured.
  - `buildPaymentOptions(...)` handles alternate costs.
- Preserve Last Known Information snapshots long enough for defeated, captured, and leaves-play abilities to resolve correctly.

### ENG-FEAT-4: The CPU
For now, the CPU will not take any actions. all puzzles begin with the prompt "Zero cards in deck. Opponent claimed initiative. How do you win?". Per the rules of SWU, once a player has claimed initiative, then they can no longer take any more actions this round (a round consists of an Action Phase and then a Regroup Phase).

### ENG-FEAT-5: Undo
When an Undo is requested, the last game state should be loaded. A message is logged "Player 1 requested undo." and previous game logs are retained. Logs will be unbounded. If there are no game states in the history, then Undo will throw an error/exception. regardless, the UI will guard against this.

## UI Requirements
### UI-FEAT-1: Simple actions the user will get to pick for each "turn".
- Play Card (hotkey=C): choose a card from the hand, pay the resources needed, then place the card in the appropriate zone
- Attack with a unit (hotkey=A): choose a Ground unit or Space unit on your side of the board that is readied, and then choose the target for the attack. Damage is dealt simultaneously if a unit is chosen.
- Action Ability (hotkey=B): choose an ability that can be used and activate it (eg. Leader abilities, Leader epic action/deploy, Base epic action/deploy, unit abilities, etc.)
- Take Initiative (hotkey=I): if the initiative has not been claimed, then you claim it and you take no more actions this phase
- Pass (hotkey=P): pass an action. if the initiative has already been taken, then both players move to the regroup phase. also if a Pass action was previously taken, then players move to the regroup phase.
- Undo (hotkey=U): go back one game state on the stack (maximum 10 game states). If there are no game states in the history, then this will be greyed out and unavailable.

#### UI-FEAT-1.1: Puzzle Reset
- another option will be to reset the puzzle in the event that the user can't figure it out. this will re-load the initial game state from the database. for this first iteration, it will just reload `test-puzzle.json` as it will only be part of a test app.

### UI-FEAT-2: Hovering
If I hover over one of the cards for more than 2 seconds, then a preview panel pops up showing the card blown up for easier reading. This applies only to the following zones:
- My Leader card, My Base card, Their Leader card, Their base card
- Any card in My Hand zone
- Any card in My Ground Zone, My Space Zone, Their Ground Zone, Their Space Zone
- Any card in My Resource Zone (hovering shows the actual card that it is)
- My Discard Zone, Their Discard Zone (hovering shows the latest discarded)
- The Force Token in the supplemental token zone
- The Credit marker in the supplemental token zone (shows the Credit card blown up)
- Any upgrade cards attached to units: including but not limited to any shield tokens or experience tokens or pilot upgrades
- all other zones do nothing when hovered over

on mobile, long-tap for 1 whole second would result in the same pop-up

### UI-FEAT-3: Subcards
- There are cards that can be attached to units. these should show as a small rectangle under the unit with the attachment's name. the background color of the rectangle should match the aspect of the card attached.
- The Capture mechanic will look similar in that a unit will be considered out of play when it is captured. When a unit is captured by another unit, it is physically placed under the capturing unit. In this mini game, we can treat it like a subcard. it'll show as a rectangle with the card's name. however, all captured units should show below the upgrades.

### UI-FEAT-4: Game Log
- meaningful interactions should be logged in a game log window that sits on the left side of the screen
- keywords that are referenced in the game log should be bolded and colored light-red (eg. "Player 1 attacks Player 2's `Gamorrean Guards` with `K-2SO` dealing 5 combat damage with 4 `Overwhelm` to the base.")

## Test Page Requirements
- the PuzzlesPage.tsx is used as a test page for this initial version of the engine.
- it will be unavailable to regular users for now. only admins.
- it will be pre-loaded with the simple-example.md game state. this game state is already extracted to a `test-puzzle.json` file (later to be fetched from a Database)

## Unit test requirements
The engine should be written in a way that actions can be unit testable.
### For example, given the test json and the following instructions:
- playCardFromHand(1) // second card from hand if using 0-index
- chooseGroundUnit(1) // second unit in the Ground arena
- chooseTheirBase() // base is allowed as target now that unit has gained "Saboteur"

this should result in the opponent now having 13 damage on their base. no other game state changes.

### another example given the same test json:
- useActionAbility() // prompts which card to use action ability for
- chooseMyLeader() // since player has enough resources to deploy, player is prompted to choose either "ability" or "deploy"
- sendPrompt("ability")

this should result in both bases being pinged for 1 damage because of Sabine Wren's ability. game state changes to
- their base now at 12 damage
- my base now at 24 damage
- my leader card is exhausted (ie. not-ready/tapped)

### preferred syntax for unit tests
Unit tests should look something like
```ts
//arrange
const game = await loadGameAsync(`test-puzzle.json`);
//act
await game.playCardFromHandAsync(1);
await game.chooseGroundUnitAsync(1);
await game.chooseTheirBaseAsync();
//assert
expect(game.currentGameState.player1.groundArena[1].ready).to.equal(false);
expect(game.getPower(game.currentGameState.player1.groundArena[1])).to.equal(2);
expect(game.getHP(game.currentGameState.player1.groundArena[1])).to.equal(1);
expect(game.currentGameState.player2.base.damage).to.equal(13);
```

The implementation may expose a chainable command wrapper later, but the MVP contract only requires a deterministic async command API.
