WIP: do not implement
# Overview
Create a mini game engine to simulate playing Star Wars Unlimited in the browser. This will be a 1-player vs CPU style game. For now, no bot logic for the CPU. The first intention for this mini game is for a puzzle mode that involves the user making decisions after the opponent has claimed initiative and will undoubtedly win next action phase.

# Preqreuisites
- PRE-1: Read the how-to-play.md located sibling to this spec.

# Requirements
## Engine Requirements
### ENG-FEAT-1: Game zones
The following are game zones that will be used to determine game state. the board is split into two halves, one for the active player and one for the opponent. the hands of both players lie outside the board itself:
- My Base: my base card. this is the win condition of the game to get damage counters on the base equal to its health. some bases have epic actions that can be used once per game. once this action has been used, a yellow X marker is put on it to note the epic action has been used. this is positioned center top of the bottom half of the board.
- My Leader: my leader card from my deck. it can be either ready, exhausted, or deployed. if it is deployed, then it no longer shows up in this zone because it has moved to the ground arena. if a leader has already used their epic action to deploy, and was defeated or returned to this zone, then it will have a yellow X marker to note the epic action has been used. this is positioned center top of the bottom half of the board., below the base.
- My Supplemental Token Zone: a smaller area that holds special tokens. for example, the Force Token is a mechanic that will create a blue token icon that can be used as a cost for certain actions. and Credit tokens are a mechanic that can be used to pay for costs where resources are also paid with. the tokens for Credit tokens will be a dark yellow square with a counter on it for the number of Credits acquired. this zone is fairly large and will reside below the Leader zone for the active player. This will also be the space to display which player has the intiative. when the black intiative token is claimed, it will appear here.
- My Space Zone: this zone will be positioned to the left of the leader and base of the active player and be the space arena for space units that are played.
- My Ground Zone: this zone will be positioned to the right of the leader and base of the active player and be the ground arena for ground units that are played.
- My Resource Zone: this zone will be positioned at the bottom of the board and start from the left and will take up 5/8 of the space. this will be all the cards placed facedown to be used as resources to pay costs. resource cards can be either exhusted or ready.
- My Deck Zone: this zone will be positioned to the right of the active player's resource zone. it will show as a stack of facedown cards with a number on it for how many cards left in deck. if there are 0 cards, then it will show as empty.
- My Discard Zone: this zone will be position to the right of the active player's deck zone. if no cards here, then it will be empty. if there are cards here, then show the most recently discarded card, and put a counter on it with the total number of cards in discard.
- My Hand Zone: this zone will be positioned at the bottom of the screen, below the game board. these cards are visible to me. and i can choose them individually. when not hovered, it will only show the top halves of the cards. when hovered, then show them fully.
- Their Base: their base card. positioned in the bottom center of the top half of the gameboard. same mechanics apply to their base as well.
- Their Leader: their leader card. positioned in the bottom center of the top half of the gameboard, above their base zone. same mechanics apply to their leader as well.
- Their Supplemental Token Zone: opponent's area that holds special tokens. This will also be the space to display which player has the intiative. when the black intiative token is claimed, it will appear on their supplemental zone. it will be positioned above their leader zone.
- Their Space Zone: this zone will be positioned to the left of their leader and base and be the space arena for space units that are played.
- Their Ground Zone: this zone will be positioned to the right of their leader and base and be the ground arena for ground units that are played.
- Their Resource Zone: this zone will be positioned at the top of the board and start from the left and will take up 5/8 of the space. this will be all the cards placed facedown to be used as resources for the opponent. same mechanics apply to them.
- Their Deck Zone: this zone will be positioned to the right of their resource zone. it will show as a stack of facedown cards with a number on it for how many cards left in deck. if there are 0 cards, then it will show as empty.
- Their Discard Zone: this zone will be position to the right of their deck zone. if no cards here, then it will be empty. if there are cards here, then show the most recently discarded card, and put a counter on it with the total number of cards in discard.
- Their Hand Zone: this zone will be positioned at the top of the screen. the cards will not be visible to me and show only facedown cards with a logo on it.

## UI Requirements
### UI-FEAT-1: Simple actions the user will get to pick for each "turn".
- Play Card (hotkey=C): choose a card from the hand, pay the resources needed, then place the card in the appropriate zone
- Attack with a unit (hotkey=A): chooes a Ground unit or Space unit on your side of the board that is readied, and then choose the target for the attack. Damage is dealt simutaneously if a unit is chosen.
- Action Ability (hotkey=B): choose an ability that can be used and activate it (eg. Leader abilities, Leader epic action/deploy, Base epic action/deploy, unit abilities, etc.)
- Take Initiative (hotkey=I): if the initiative has not been claimed, then you claim it and you take no more actions this phase
- Pass (hotkey=P): pass an action. if the intiative has already been taken, then move to the regroup phase.
- Undo (hotkey=U): go back one action on the stack (maximum 10 actions).

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

### UI-FEAT-3: Subcards
- There are cards that can be attached to units. these should show as a small rectangle under the unit with the attachment's name. the background color of the rectangle should match the aspect of the card attached.
- The Capture mechanic will look similar in that a unit will be considered out of play when it is captured. When a unit is captured by another unit, it is physically placed under the capturing unit. In this mini game, we can treat it like a subcard. it'll show as a rectangle with the card's name. however, all captured units should show below the upgrades.