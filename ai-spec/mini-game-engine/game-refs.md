# Overview
Context for game terminology and rules to consider

# Aspects
there are 6 aspects
- Vigilance: blue
- Command: green
- Aggression: red
- Cunning: yellow
- Villainy: black
- Heroism: white

a card can have 0 or more aspects and any mix of these (eg. `Vigilance,Heroism`, `Command,Command`,`Aggression,Villainy`,`Cunning`,`Vigilance,Cunning`, etc.)

if a card has no aspects, then its color for reference is a light grey.

# Keywords
Shielded: when unit is played or deployed or created, create a shield token and give it to this unit
Saboteur: this unit can bypass Sentinels. if it attacks a shielded unit, it defeats all shields before dealing combat damage.
Raid N: gets +N power on attack
Restore N: heals N damage from base on attack
Sentinel: enemy units in this unit's arena can't attack the base or other units (unless they have Sentinel)
Grit: this unit gets +1 power for each damage counter on it
Ambush: when unit is played or deployed or created, you may ready them and attack an enemy unit.
Smuggle Y: this unit can be played from the resource zone with Y cost (usually only resources but there might be other conditions)
Bounty: when this unit is defeated, its opponent may collect the bounty triggering the effect.
Hidden: when unit is played or deployed or created, it cannot be attacked this phase.
Coordinate: while you control 3 or more units, the specified ability is active.
Exploit N: when paying costs for this unit, you may defeat up to N friendly units to pay 2 less resources for each unit defeated this way.
Piloting Y: this unit can be played onto a Vehicle without a pilot on it for the cost Y.
Plot: when a leader is deployed, you may play this card from your resources paying its cost.

when Smuggle or Plot are used, the top card of the deck is placed into the resource zone exhausted. if there are no cards in deck, then ignore it. the resource is just lost in this case.

if a keyword has N, then it can have a number that can be added up.
For example, a unit has Raid 2 and gains an effect of Raid 1. It now has a total Raid 3 (+3 power on attack).

# Tokens
## Token Upgrades
All token upgrades are 0 cost
- Shield Token: token upgrades that provide +0/+0 with the effect to prevent damage that would be done to a unit by defeating a shield token on the unit. it has the trait "Armor"
- Experience Token: token upgrades that give a unit +1/+1 stats (power/hp) with no other effect. it has the trait "Learned"
## Token Units
All token units are 0 cost
- Battle Droid: a 1/1 `Villainy` Ground unit with the traits "Separatist,Droid,Trooper"
- Clone Trooper: a 2/2 `Heroism` Ground unit with the traits "Republic,Clone,Trooper"
- TIE Fighter: a 1/1 `Villainy` Space unit with the traits "Vehicle,Fighter"
- X-Wing: a 2/2 `Heroism` Space unit with the traits "Vehicle,Fighter"
- Spy: a 0/2 Ground unit with no aspects. it has `Raid 2` keyword and the trait "Official"
## Special Tokens
- Force Token: used as a cost for certain abilities. it is of type "Force Token". there is only one Force Token per player and they can only create or defeat this token. it is created from effects that state "The Force is with you." and it is defeated by effects that state "Use the Force."
- Credit Tokens: special tokens with the effect "While paying resources, you may defeat this token. If you do, pay 1R less". It is of type "Credit Token" and has the trait "Supply".